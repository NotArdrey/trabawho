import {
  assertPublicSignupAllowed, cleanString, corsHeaders, createAdminClient, createSessionNonce,
  findProfileByEmail, hashSessionNonce, jsonResponse, normalizeEmail, recordRegistrationAttempt,
  RegistrationRateLimitError, sha256Hex, updateRegistrationAttempt, verifySessionNonce,
  sanitizeIdentityVerificationData,
} from "../_shared/identityRegistration.ts";
import { asRecord, normalizeStatus, resolveDiditDecisionStatus } from "../_shared/identityDomain.ts";

import { identityReturnUrl } from "../_shared/identityRedirect.ts";

const DIDIT_URL = "https://verification.didit.me/v3/session/";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  try {
    const body = asRecord(await req.json());
    const client = createAdminClient();
    const apiKey = Deno.env.get("DIDIT_API_KEY") || "";
    if (!apiKey) throw new Error("Identity verification is unavailable. Try again later.");
    if (body.action === "get_session") {
      const sessionId = cleanString(body.session_id);
      const { data, error } = await client.from("verification_sessions").select("status,verification_data").eq("session_ref", sessionId).maybeSingle();
      const session = asRecord(data);
      const metadata = asRecord(session.verification_data);
      if (error || !data || !metadata.session_nonce_hash ||
        !(await verifySessionNonce(sessionId, body.session_nonce, metadata.session_nonce_hash)))
        return jsonResponse({ success: false, error: "Verification session could not be validated. Restart registration." }, 403);
      let status = normalizeStatus(session.status);
      let rawStatus: string | null = null;
      // A saved admin decision or duplicate hold must not be overwritten by polling.
      if (!metadata.finalized_at && status !== "SUPERSEDED") {
        const checkedAt = new Date().toISOString();
        const live = await fetch(`${DIDIT_URL}${encodeURIComponent(sessionId)}/decision/`, {
          headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(8000),
        });
        if (live.ok) {
          const payload = asRecord(await live.json());
          const liveStatus = resolveDiditDecisionStatus(payload);
          if (liveStatus) {
            rawStatus = typeof payload.status === "string" ? payload.status : null;
            const update = await client.rpc("refresh_didit_session_status", {
              p_session_id: sessionId, p_status: liveStatus, p_decision: sanitizeIdentityVerificationData(payload), p_checked_at: checkedAt,
            });
            if (update.error) throw new Error("The verification result could not be saved. Retry.");
            status = normalizeStatus(asRecord(update.data).status);
          }
        }
      }
      // Never return stored email, nonce hashes, report images or document data.
      return jsonResponse({ success: true, sessionId, status, businessStatus: status, rawDiditStatus: rawStatus });
    }
    const email = normalizeEmail(body.email);
    const appRole = cleanString(body.app_role || body.appRole);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["client", "worker"].includes(appRole))
      throw new Error("Enter a valid email and choose a client or worker account.");
    const identityRole = appRole === "worker" ? "musician" : "fan";
    const profile = await findProfileByEmail(client, email);
    assertPublicSignupAllowed(profile, appRole);
    const workflow = Deno.env.get("DIDIT_WORKFLOW_ID") || "";
    if (!workflow) throw new Error("Identity verification is unavailable. Configure the Didit workflow.");
    const existingId = cleanString(body.existing_session_id);
    if (existingId) {
      const previous = await client.from("verification_sessions").select("status,verification_data").eq("session_ref", existingId).maybeSingle();
      const session = asRecord(previous.data); const metadata = asRecord(session.verification_data);
      if (metadata.email === email && normalizeStatus(session.status) === "PENDING" &&
        await verifySessionNonce(existingId, body.existing_session_nonce, metadata.session_nonce_hash)) {
        return jsonResponse({ success: true, sessionId: existingId, sessionNonce: cleanString(body.existing_session_nonce),
          workflowId: workflow, verificationUrl: metadata.session_url, status: "PENDING", reused: true });
      }
      throw new Error("The previous verification session could not be validated. Restart registration.");
    }
    const attemptId = await recordRegistrationAttempt(client, req, { action: "create_didit_session", email, metadata: { appRole } });
    const signupRef = `TEMP_SIGNUP_${(await sha256Hex(email)).slice(0, 16)}_${crypto.randomUUID()}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const callback = new URL(`${supabaseUrl}/functions/v1/verification-redirect`);
    callback.searchParams.set("redirect_to", identityReturnUrl(body.redirect_url || body.callback, Deno.env.get("TRABAWHO_APP_URL") || "", Deno.env.get("IDENTITY_ALLOWED_ORIGINS") || "").toString());
    const response = await fetch(DIDIT_URL, {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ workflow_id: workflow, vendor_data: signupRef,
        callback: callback.toString(), callback_method: "both", language: "en",
        contact_details: { email, send_notification_emails: false },
        metadata: { signup_role: identityRole, app_role: appRole, document_type: cleanString(body.document_type) },
      }), signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      await updateRegistrationAttempt(client, attemptId, { success: false, reason: `didit_create_${response.status}` });
      throw new Error("Didit could not create a verification session. Check the configured workflow and retry.");
    }
    const created = asRecord(await response.json());
    const sessionId = cleanString(created.session_id);
    const verificationUrl = cleanString(created.url);
    if (!sessionId || !verificationUrl.startsWith("https://")) throw new Error("Didit did not return a usable session.");
    // A provider may return an unfinished session for the same vendor_data.
    // Keep its existing nonce; never rotate ownership through a public request.
    const previous = await client.from("verification_sessions").select("verification_data").eq("session_ref", sessionId).maybeSingle();
    if (previous.error) throw new Error("Session storage could not be checked. Retry.");
    if (previous.data) throw new Error("A verification is already in progress. Continue it in the browser that started registration.");
    const nonce = createSessionNonce();
    const session = { user_id: null, session_ref: sessionId, status: "PENDING", verification_data: {
      vendor_data: signupRef, email, signup_role: identityRole, app_role: appRole,
      workflow_id: workflow, document_type: cleanString(body.document_type), session_url: verificationUrl,
      session_nonce_hash: await hashSessionNonce(sessionId, nonce), started_at: new Date().toISOString(),
    }};
    const saved = await client.from("verification_sessions").insert(session);
    if (saved.error) throw new Error("Verification session could not be saved. Retry registration.");
    await updateRegistrationAttempt(client, attemptId, { success: true, didit_session_id: sessionId });
    return jsonResponse({ success: true, sessionId, sessionNonce: nonce, workflowId: workflow, verificationUrl });
  } catch (error) {
    console.error("create_didit_session_failed", { type: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Verification could not be started." }, error instanceof RegistrationRateLimitError ? 429 : 400);
  }
});
