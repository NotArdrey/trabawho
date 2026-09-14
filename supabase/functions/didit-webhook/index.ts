// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  buildIdentityDocumentFingerprint,
  cleanString,
  corsHeaders,
  createAdminClient,
  extractIdentityDocument,
  findDecisionObject,
  firstString,
  hmacSha256Hex,
  isUuid,
  jsonResponse,
  normalizeEmail,
  normalizeStatus,
  queueManualIdentityReview,
  resolveDiditDecisionStatus,
  sanitizeIdentityVerificationData,
  sendEmailConfirmation,
  sha256Hex,
  upsertIdentityDocumentClaim,
} from "../_shared/identityRegistration.ts";

const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
};

const hasFreshTimestamp = (value: string) => {
  const timestamp = Number.parseInt(value, 10);
  if (!Number.isFinite(timestamp)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - timestamp) <= 300;
};

const sortJsonKeys = (value: any): any => {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result: Record<string, unknown>, key) => {
      result[key] = sortJsonKeys(value[key]);
      return result;
    }, {});
  }
  return value;
};

const verifyWebhookSignature = async (rawBody: string, payload: any, headers: Headers) => {
  const secret = cleanString(Deno.env.get("DIDIT_WEBHOOK_SECRET") || Deno.env.get("WEBHOOK_SECRET_KEY"));
  const timestamp = cleanString(headers.get("x-timestamp"));
  if (!secret || !timestamp || !hasFreshTimestamp(timestamp)) return false;

  const signatureV2 = cleanString(headers.get("x-signature-v2")).toLowerCase();
  const signature = cleanString(headers.get("x-signature")).toLowerCase();
  const signatureSimple = cleanString(headers.get("x-signature-simple")).toLowerCase();

  if (signatureV2) {
    const expected = await hmacSha256Hex(JSON.stringify(sortJsonKeys(payload)), secret);
    if (constantTimeEqual(expected, signatureV2)) return "v2";
  }

  if (signature) {
    const expected = await hmacSha256Hex(rawBody, secret);
    if (constantTimeEqual(expected, signature)) return "raw";
  }

  if (signatureSimple) {
    const expected = await hmacSha256Hex([
      payload?.timestamp || "",
      payload?.session_id || payload?.sessionId || "",
      payload?.status || "",
      payload?.webhook_type || payload?.event || payload?.type || "",
    ].join(":"), secret);
    if (constantTimeEqual(expected, signatureSimple)) return "simple";
  }

  return null;
};

const fetchAuthoritativeDecision = async (sessionId: string) => {
  const apiKey = cleanString(Deno.env.get("DIDIT_API_KEY"));
  if (!apiKey) throw new Error("DIDIT_API_KEY is required to validate a legacy webhook signature.");

  const response = await fetch(
    `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`,
    {
      method: "GET",
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    },
  );
  if (!response.ok) throw new Error(`Unable to retrieve the Didit decision (${response.status}).`);
  return response.json();
};

const recordWebhookEvent = async (supabaseAdmin: any, payload: any, rawBody: string) => {
  const payloadHash = await sha256Hex(rawBody);
  const sessionId = cleanString(payload?.session_id || payload?.sessionId || payload?.id);
  const explicitKey = cleanString(payload?.event_id || payload?.webhook_id || payload?.webhook_event_id || payload?.event?.id);
  const eventKey = explicitKey
    ? `didit:${explicitKey}`
    : `didit:${sessionId || "unknown"}:${cleanString(payload?.status)}:${cleanString(payload?.webhook_type || payload?.event || payload?.type)}:${payloadHash}`;

  const { error } = await supabaseAdmin.from("didit_webhook_events").insert({
    event_key: eventKey,
    session_id: sessionId || null,
    status: cleanString(payload?.status) || null,
    payload_hash: payloadHash,
    processed_at: new Date().toISOString(),
  });

  if (!error) return { duplicate: false, eventKey };
  if (error.code === "23505" || /duplicate key/i.test(error.message || "")) {
    return { duplicate: true, eventKey };
  }
  throw error;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let recordedEventKey = "";
  let eventClient: any = null;

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const signatureVariant = await verifyWebhookSignature(rawBody, payload, req.headers);

    if (!signatureVariant) {
      return jsonResponse({ error: "Invalid Didit webhook signature" }, 401);
    }

    const webhookType = cleanString(payload.webhook_type || payload.event || payload.type);
    if (!["status.updated", "data.updated"].includes(webhookType)) {
      return jsonResponse({ received: true, ignored: true, webhookType });
    }

    const sessionId = cleanString(payload.session_id || payload.sessionId || payload.id);
    if (!sessionId) return jsonResponse({ error: "Didit session ID is required." }, 400);

    const authoritativePayload = signatureVariant === "simple"
      ? await fetchAuthoritativeDecision(sessionId)
      : payload;
    const sourcePayload = signatureVariant === "simple"
      ? {
        ...payload,
        status: authoritativePayload.status || payload.status,
        vendor_data: authoritativePayload.vendor_data || payload.vendor_data,
        decision: authoritativePayload,
      }
      : payload;

    const supabaseAdmin = createAdminClient();
    eventClient = supabaseAdmin;
    const webhookEvent = await recordWebhookEvent(supabaseAdmin, payload, rawBody);
    if (webhookEvent.duplicate) {
      return jsonResponse({ received: true, duplicate: true });
    }
    recordedEventKey = webhookEvent.eventKey;

    const vendorData = cleanString(sourcePayload.vendor_data || sourcePayload.reference || sourcePayload.external_id || sourcePayload.metadata?.user_id);
    const decision = findDecisionObject(sourcePayload);
    const status = resolveDiditDecisionStatus(sourcePayload) || normalizeStatus(sourcePayload.status) || "PENDING";
    const sanitizedPayload = sanitizeIdentityVerificationData(sourcePayload);
    const document = extractIdentityDocument(sourcePayload);
    const documentFingerprint = await buildIdentityDocumentFingerprint(sourcePayload, {
      documentTypeKey: document.documentType,
      fullName: document.fullName,
    }).catch(() => null);

    const { data: existingSession } = await supabaseAdmin
      .from("verification_sessions")
      .select("user_id, verification_data")
      .eq("session_ref", sessionId)
      .maybeSingle();
    const linkedUserId = firstString([
      isUuid(vendorData) ? vendorData : "",
      existingSession?.user_id,
      existingSession?.verification_data?.account_user_id,
    ]);

    await supabaseAdmin
      .from("verification_sessions")
      .upsert({
        session_ref: sessionId,
        status,
        user_id: isUuid(linkedUserId) ? linkedUserId : null,
        verification_data: {
          ...(existingSession?.verification_data || {}),
          status,
          raw_didit_status: sourcePayload.status || null,
          vendor_data: vendorData || existingSession?.verification_data?.vendor_data || null,
          decision: sanitizeIdentityVerificationData(decision),
          raw_payload: sanitizedPayload,
          webhook_received_at: new Date().toISOString(),
        },
      }, { onConflict: "session_ref" });

    let effectiveStatus = status;
    if (isUuid(linkedUserId)) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, role, identity_role, verification_status")
        .eq("user_id", linkedUserId)
        .maybeSingle();

      const { data: duplicateReview } = await supabaseAdmin
        .from("manual_identity_reviews")
        .select("id")
        .eq("user_id", linkedUserId)
        .eq("didit_session_id", sessionId)
        .eq("source", "DIDIT_DUPLICATE")
        .eq("status", "PENDING_REVIEW")
        .limit(1)
        .maybeSingle();
      if (status === "APPROVED" && duplicateReview?.id) effectiveStatus = "PENDING_REVIEW";

      const appRole = cleanString(profile?.role || "client");
      const identityRole = cleanString(profile?.identity_role || (appRole === "worker" ? "musician" : "fan"));
      const verifiedAt = effectiveStatus === "APPROVED" ? new Date().toISOString() : null;
      const profileUpdate = {
        verification_status: effectiveStatus,
        identity_required: true,
        identity_role: identityRole,
        didit_session_id: sessionId || null,
        id_document_expiry: document.expiry || null,
        is_verified: effectiveStatus === "APPROVED",
        id_verified_at: verifiedAt,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin.from("profiles").update(profileUpdate).eq("user_id", linkedUserId);

      if (effectiveStatus === "APPROVED") {
        await supabaseAdmin
          .from("manual_identity_reviews")
          .update({ status: "APPROVED", review_reason: "DIDIT_RESOLVED", reviewed_at: verifiedAt })
          .eq("user_id", linkedUserId)
          .eq("didit_session_id", sessionId)
          .eq("source", "DIDIT_PENDING")
          .eq("status", "PENDING_REVIEW");

        if (normalizeEmail(profile?.email) && normalizeStatus(profile?.verification_status) !== "APPROVED") {
          await sendEmailConfirmation(
            normalizeEmail(profile?.email),
            cleanString(Deno.env.get("EMAIL_CONFIRM_REDIRECT_TO")),
          );
        }
      }

      if (effectiveStatus === "APPROVED" || effectiveStatus === "PENDING_REVIEW") {
        const review = effectiveStatus === "PENDING_REVIEW" && !duplicateReview?.id
          ? await queueManualIdentityReview(supabaseAdmin, {
            userId: linkedUserId,
            email: normalizeEmail(profile?.email),
            role: identityRole,
            appRole,
            documentType: document.documentType || "Government ID",
            documentTypeKey: document.documentType || null,
            source: "DIDIT_PENDING",
            diditSessionId: sessionId,
            documentFingerprint,
            metadata: { diditWebhook: sanitizedPayload },
            verifiedFullLegalName: document.fullName,
            normalizedFullLegalName: document.normalizedFullName,
            birthDate: document.birthDate,
          })
          : null;

        await upsertIdentityDocumentClaim(supabaseAdmin, {
          userId: linkedUserId,
          role: identityRole,
          appRole,
          documentFingerprint,
          documentType: document.documentType || "Government ID",
          documentTypeKey: document.documentType || null,
          source: "DIDIT",
          status: effectiveStatus,
          diditSessionId: sessionId,
          manualReviewId: review?.id || null,
          email: profile?.email || null,
          metadata: { diditWebhook: sanitizedPayload },
          verifiedFullLegalName: document.fullName,
          normalizedFullLegalName: document.normalizedFullName,
          birthDate: document.birthDate,
        });
      }
    }

    return jsonResponse({ received: true, sessionId, status: effectiveStatus });
  } catch (error) {
    if (recordedEventKey && eventClient) {
      await eventClient.from("didit_webhook_events").delete().eq("event_key", recordedEventKey);
    }
    console.error("didit_webhook_failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to process Didit webhook." }, 500);
  }
});

