// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  assertPublicSignupAllowed,
  cleanString,
  corsHeaders,
  createAdminClient,
  createSessionNonce,
  findDecisionObject,
  findProfileByEmail,
  firstString,
  hashSessionNonce,
  identityRoleFromAppRole,
  isUuid,
  jsonResponse,
  normalizeAppRole,
  normalizeEmail,
  normalizeIdentityRole,
  normalizeStatus,
  parseJsonBody,
  recordRegistrationAttempt,
  RegistrationRateLimitError,
  resolveDiditDecisionStatus,
  sanitizeIdentityVerificationData,
  sha256Hex,
  updateRegistrationAttempt,
} from "../_shared/identityRegistration.ts";
import {
  assertCompleteRegistrationDetails,
  normalizeRegistrationDetails,
} from "../_shared/registrationDetails.ts";

const DIDIT_SESSION_URL = "https://verification.didit.me/v3/session/";
const DIDIT_DOCUMENT_CODES: Record<string, "ID" | "P" | "DL"> = {
  id_card: "ID",
  passport: "P",
  drivers_license: "DL",
};

const isHttpUrl = (value: unknown) => /^https?:\/\//i.test(cleanString(value));

const resolveDiditVerificationUrl = (diditData: any) => {
  const explicitUrl = firstString([
    diditData?.verificationUrl,
    diditData?.verification_url,
    diditData?.url,
    diditData?.sessionUrl,
    diditData?.session_url,
    diditData?.session?.verification_url,
    diditData?.session?.url,
    diditData?.links?.verification_url,
    diditData?.links?.url,
  ]);
  if (isHttpUrl(explicitUrl)) return explicitUrl;

  const sessionToken = firstString([
    diditData?.session_token,
    diditData?.sessionToken,
    diditData?.token,
    diditData?.session?.session_token,
    diditData?.session?.token,
  ]);
  return sessionToken ? `https://verify.didit.me/session/${encodeURIComponent(sessionToken)}` : "";
};

const fetchDiditSession = async (sessionId: string, apiKey: string) => {
  try {
    const response = await fetch(
      `${DIDIT_SESSION_URL}${encodeURIComponent(sessionId)}/decision/`,
      {
        method: "GET",
        headers: { "x-api-key": apiKey, Accept: "application/json" },
      },
    );
    if (!response.ok) {
      console.error("didit_session_fetch_failed", { sessionId, status: response.status });
      return {};
    }
    return await response.json();
  } catch (error) {
    console.error("didit_session_fetch_failed", {
      sessionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
};

const parseDiditErrorDetails = async (response: Response) => {
  const text = await response.text().catch(() => "");
  if (!text) return "";

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const createDiditSession = async (apiKey: string, payload: Record<string, unknown>) =>
  fetch(DIDIT_SESSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

const handleGetSession = async (body: any) => {
  const sessionId = cleanString(body?.session_id || body?.sessionId);
  if (!sessionId) return jsonResponse({ success: false, error: "session_id is required" });

  const diditApiKey = Deno.env.get("DIDIT_API_KEY") || "";
  const supabaseAdmin = createAdminClient();

  const { data: localSession } = await supabaseAdmin
    .from("verification_sessions")
    .select("status, verification_data")
    .eq("session_ref", sessionId)
    .maybeSingle();

  const diditSession = diditApiKey ? await fetchDiditSession(sessionId, diditApiKey) : {};
  const liveStatus = resolveDiditDecisionStatus(diditSession);
  const localStatus = normalizeStatus(localSession?.status || localSession?.verification_data?.status);
  const status = liveStatus || localStatus || "PENDING";

  if (status && status !== localStatus) {
    await supabaseAdmin
      .from("verification_sessions")
      .update({
        status,
        verification_data: {
          ...(localSession?.verification_data || {}),
          status,
          raw_didit_status: diditSession?.status || null,
          decision: sanitizeIdentityVerificationData(findDecisionObject(diditSession)),
          last_checked_at: new Date().toISOString(),
        },
      })
      .eq("session_ref", sessionId);
  }

  return jsonResponse({
    success: true,
    sessionId,
    status,
    businessStatus: status,
    diditResolvedStatus: liveStatus || null,
    rawDiditStatus: diditSession?.status || null,
    verification_data: {
      ...(localSession?.verification_data || {}),
      status,
    },
  });
};

const buildVendorData = async (userId: unknown, email: string) => {
  const explicitUserId = cleanString(userId);
  if (!email || !explicitUserId.startsWith("TEMP_")) return explicitUserId;
  const emailHash = await sha256Hex(email);
  return `TEMP_SIGNUP_${emailHash.slice(0, 32)}`;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await parseJsonBody(req);
    if (body?.action === "get_session") return handleGetSession(body);

    const diditApiKey = Deno.env.get("DIDIT_API_KEY") || "";
    const workflowId = Deno.env.get("DIDIT_WORKFLOW_ID") || "";
    const supabaseUrl = Deno.env.get("TRABAWHO_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("TRABAWHO_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const appUrl = Deno.env.get("TRABAWHO_APP_URL") || Deno.env.get("SITE_URL") || "";

    if (!diditApiKey || !workflowId || !supabaseUrl || !anonKey || !appUrl) {
      return jsonResponse({
        success: false,
        error: "Didit registration is not configured. Set DIDIT_API_KEY, DIDIT_WORKFLOW_ID, SUPABASE_URL, SUPABASE_ANON_KEY, and TRABAWHO_APP_URL.",
      });
    }

    const userId = cleanString(body?.userId || body?.user_id);
    const email = normalizeEmail(body?.email);
    const appRole = normalizeAppRole(body?.app_role || body?.appRole);
    const identityRole = normalizeIdentityRole(body?.role || identityRoleFromAppRole(appRole));
    const documentType = cleanString(body?.document_type || body?.documentType || "id_card");
    const expectedDocumentType = DIDIT_DOCUMENT_CODES[documentType];
    const registrationDetails = normalizeRegistrationDetails(body);

    if (!userId) return jsonResponse({ success: false, error: "userId is required" });
    if (!email) return jsonResponse({ success: false, error: "email is required" });
    if (!expectedDocumentType) return jsonResponse({ success: false, error: "Choose a Didit-supported identity document." });
    assertCompleteRegistrationDetails(registrationDetails);

    const supabaseAdmin = createAdminClient();
    const existingProfile = await findProfileByEmail(supabaseAdmin, email);
    assertPublicSignupAllowed(existingProfile, appRole);

    const attemptId = await recordRegistrationAttempt(supabaseAdmin, req, {
      action: "create_didit_session",
      email,
      metadata: { identityRole, appRole, documentType },
    });

    const vendorData = await buildVendorData(userId, email);
    const consentCapturedAt = new Date().toISOString();
    const redirectBridge = new URL(`${supabaseUrl}/functions/v1/verification-redirect`);
    redirectBridge.searchParams.set("vendor_data", vendorData);
    redirectBridge.searchParams.set("apikey", anonKey);
    redirectBridge.searchParams.set(
      "redirect_to",
      new URL("/sign-in?check_verification=true", appUrl).toString(),
    );

    const buildSessionPayload = (nextWorkflowId: string) => ({
      workflow_id: nextWorkflowId,
      vendor_data: vendorData,
      callback: redirectBridge.toString(),
      callback_method: "both",
      language: "en",
      metadata: {
        signup_attempt_ref: userId.startsWith("TEMP_") ? userId : undefined,
        signup_role: identityRole,
        app_role: appRole,
        document_type: documentType,
        expected_document_type: expectedDocumentType,
      },
      contact_details: {
        email,
        send_notification_emails: false,
      },
      expected_details: {
        id_country: "PHL",
        expected_document_types: [expectedDocumentType],
      },
    });

    const diditResponse = await createDiditSession(diditApiKey, buildSessionPayload(workflowId));

    if (!diditResponse.ok) {
      const details = await parseDiditErrorDetails(diditResponse);
      console.error("didit_session_create_failed", {
        status: diditResponse.status,
        details,
      });
      await updateRegistrationAttempt(supabaseAdmin, attemptId, {
        success: false,
        reason: `didit_create_failed_${diditResponse.status}`,
      });
      const error = diditResponse.status === 429
        ? "Didit is temporarily rate limited. Please wait and try again."
        : "Didit could not start verification. Check the configured KYC workflow and try again.";
      return jsonResponse({ success: false, error });
    }

    const diditData = await diditResponse.json();
    const sessionId = firstString([diditData.session_id, diditData.id, diditData.session?.id]);
    const verificationUrl = resolveDiditVerificationUrl(diditData);
    const initialStatus = normalizeStatus(diditData.status) || "PENDING";

    if (!sessionId || !verificationUrl) {
      await updateRegistrationAttempt(supabaseAdmin, attemptId, {
        success: false,
        reason: "didit_create_missing_session_or_url",
      });
      return jsonResponse({
        success: false,
        error: "Didit created a session but did not return a usable session URL.",
      });
    }

    const sessionNonce = createSessionNonce();
    const sessionNonceHash = await hashSessionNonce(sessionId, sessionNonce);

    if (email) {
      await supabaseAdmin
        .from("verification_sessions")
        .update({ status: "SUPERSEDED" })
        .eq("verification_data->>email", email)
        .in("status", ["PENDING", "NOT_STARTED", "IN_PROGRESS"])
        .neq("session_ref", sessionId);
    }

    const sessionPayload = {
      user_id: isUuid(userId) ? userId : null,
      session_ref: sessionId,
      status: initialStatus,
      verification_data: {
        status: initialStatus,
        raw_didit_status: diditData.status || null,
        user_ref: vendorData,
        vendor_data: vendorData,
        signup_attempt_ref: userId.startsWith("TEMP_") ? userId : null,
        email,
        signup_role: identityRole,
        app_role: appRole,
        document_type: documentType,
        workflow_id: workflowId,
        session_url: verificationUrl,
        session_nonce_hash: sessionNonceHash,
        registration: {
          service_location: {
            province: registrationDetails.province,
            city_municipality: registrationDetails.city,
            barangay: registrationDetails.barangay,
            specific_address: registrationDetails.address,
          },
          consent: {
            identity_verification_consent: registrationDetails.identityVerificationConsent,
            data_privacy_consent: registrationDetails.dataPrivacyConsent,
            captured_at: consentCapturedAt,
            verification_provider: "DIDIT",
            didit_privacy_notice_url: "https://didit.me/terms/verification-privacy-notice/",
            didit_terms_url: "https://didit.me/terms/identity-verification/",
          },
        },
        started_at: new Date().toISOString(),
      },
    };

    await supabaseAdmin.from("verification_sessions").upsert(sessionPayload, { onConflict: "session_ref" });
    await updateRegistrationAttempt(supabaseAdmin, attemptId, {
      success: true,
      didit_session_id: sessionId,
      metadata: { identityRole, appRole, documentType, workflowId },
    });

    return jsonResponse({
      success: true,
      sessionId,
      sessionNonce,
      workflowId,
      verificationUrl,
    });
  } catch (error) {
    console.error("create_didit_session_failed", error);
    const message = error instanceof RegistrationRateLimitError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unable to create Didit session.";
    return jsonResponse({ success: false, error: message }, error instanceof RegistrationRateLimitError ? 429 : 200);
  }
});
