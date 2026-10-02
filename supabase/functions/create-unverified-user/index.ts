import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  appRoleFromIdentityRole,
  assertPublicSignupAllowed,
  buildDeferredEmailDelivery,
  buildIdentityDocumentFingerprint,
  buildProfilePayload,
  cleanString,
  corsHeaders,
  createAdminClient,
  extractIdentityDocument,
  findAuthUserByEmail,
  findDecisionObject,
  findDuplicateIdentityClaim,
  findProfileByEmail,
  firstString,
  isApprovedOrReviewStatus,
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
  sendEmailConfirmation,
  updateRegistrationAttempt,
  verifySessionNonce,
} from "../_shared/identityRegistration.ts";

import { validateSignupDetails } from "../_shared/identityDomain.ts";

const fetchLiveDiditDecision = async (sessionId: string) => {
  const diditApiKey = Deno.env.get("DIDIT_API_KEY") || "";
  if (!diditApiKey || !sessionId) return {};

  let merged: Record<string, unknown> = {};
  for (const url of [
    `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`,
    `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}`,
  ]) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": diditApiKey,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      merged = { ...merged, ...payload };
    } catch (error) {
      console.error("create_unverified_user_didit_lookup_failed", {
        sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return merged;
};

const ensureSignupAuthUser = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  { email, password, identityRole, appRole, fullName, identityStatus, diditSessionId, documentType, documentTypeKey }: Record<string, unknown>,
) => {
  const existingUser = await findAuthUserByEmail(supabaseAdmin, normalizeEmail(email));
  const metadata = {
    ...(existingUser?.user_metadata || {}),
    role: normalizeAppRole(appRole),
    identity_role: normalizeIdentityRole(identityRole),
    verification_status: normalizeStatus(identityStatus),
    identity_required: true,
    is_verified: false,
    full_name: cleanString(fullName) || normalizeEmail(email).split("@")[0] || "TrabaWho User",
    selected_document_type: cleanString(documentType),
    selected_document_type_key: cleanString(documentTypeKey),
    verification_mode: "didit",
    didit_session_id: cleanString(diditSessionId),
  };

  if (existingUser) {
    if (existingUser.email_confirmed_at) throw new Error("This email already has an account. Contact support to retry identity verification.");
    const updatePayload: Record<string, unknown> = { user_metadata: metadata };
    if (cleanString(password).length >= 8) updatePayload.password = password;

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, updatePayload);
    if (error || !data?.user) throw new Error(error?.message || "Unable to update the existing signup user.");
    return data.user;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizeEmail(email),
    password: cleanString(password),
    email_confirm: false,
    user_metadata: metadata,
  });

  if (error || !data?.user) throw new Error(error?.message || "Unable to create the account.");
  return data.user;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await parseJsonBody(req);
    const location = validateSignupDetails(body);
    const email = normalizeEmail(body?.email);
    const password = cleanString(body?.password);
    const identityRole = normalizeIdentityRole(body?.role || body?.identityRole);
    const appRole = normalizeAppRole(body?.appRole || body?.app_role || appRoleFromIdentityRole(identityRole));
    const fullName = cleanString(body?.fullName || body?.displayName);
    const diditSessionId = cleanString(body?.diditSessionId || body?.didit_session_id);
    const sessionNonce = cleanString(body?.sessionNonce || body?.session_nonce);
    const documentType = cleanString(body?.selectedDocumentType || body?.documentType || "Government ID");
    const documentTypeKey = cleanString(body?.selectedDocumentTypeKey || body?.documentTypeKey || "id_card");
    const redirectTo = firstString([body?.redirectTo, body?.redirect_to, Deno.env.get("EMAIL_CONFIRM_REDIRECT_TO")]);

    if (!email || !password) return jsonResponse({ success: false, error: "Email and password are required." });
    if (password.length < 8) return jsonResponse({ success: false, error: "Password must be at least 8 characters." });
    if (!diditSessionId) return jsonResponse({ success: false, error: "Didit session is required." });

    const supabaseAdmin = createAdminClient();
    const existingProfile = await findProfileByEmail(supabaseAdmin, email);
    const attemptId = await recordRegistrationAttempt(supabaseAdmin, req, {
      action: "create_unverified_user",
      email,
      diditSessionId,
      metadata: { identityRole, appRole, documentTypeKey },
    });

    const { data: localSession, error: sessionError } = await supabaseAdmin
      .from("verification_sessions")
      .select("status, verification_data")
      .eq("session_ref", diditSessionId)
      .maybeSingle();

    if (sessionError || !localSession) {
      await updateRegistrationAttempt(supabaseAdmin, attemptId, { success: false, reason: "missing_didit_session" });
      return jsonResponse({ success: false, error: "Didit session could not be validated. Please restart identity verification." });
    }

    const nonceHash = localSession?.verification_data?.session_nonce_hash;
    if (!nonceHash || !(await verifySessionNonce(diditSessionId, sessionNonce, nonceHash))) {
      await updateRegistrationAttempt(supabaseAdmin, attemptId, { success: false, reason: "invalid_session_nonce" });
      return jsonResponse({ success: false, error: "Didit session could not be validated. Please restart identity verification." });
    }

    const storedEmail = normalizeEmail(localSession?.verification_data?.email);
    if (!storedEmail || storedEmail !== email) {
      return jsonResponse({ success: false, error: "Didit session email does not match this signup." });
    }

    if (normalizeStatus(localSession.status) === "SUPERSEDED") throw new Error("This session was replaced. Restart verification.");
    if (existingProfile?.didit_session_id === diditSessionId && localSession.verification_data?.finalized_at) {
      return jsonResponse({ success: true, userId: existingProfile.user_id, identityStatus: existingProfile.verification_status,
        message: "Registration is already saved. Confirm your email after identity approval." });
    }
    assertPublicSignupAllowed(existingProfile, appRole);
    if (localSession.verification_data?.app_role !== appRole) throw new Error("The account type must match the verification session.");
    const liveDidit = await fetchLiveDiditDecision(diditSessionId);
    const localPayload = {
      ...localSession.verification_data,
      status: localSession.status,
    };
    const liveStatus = resolveDiditDecisionStatus(liveDidit);
    const localStatus = resolveDiditDecisionStatus(localPayload);
    const resolvedStatus = liveStatus || localStatus;

    if (!isApprovedOrReviewStatus(resolvedStatus)) {
      await updateRegistrationAttempt(supabaseAdmin, attemptId, {
        success: false,
        reason: `didit_not_ready_${resolvedStatus || "unknown"}`,
      });
      return jsonResponse({ success: false, error: "Didit verification is not approved or pending review yet. Please try again." });
    }

    const diditVerificationData = sanitizeIdentityVerificationData({
      ...localPayload,
      liveDecision: findDecisionObject(liveDidit),
    });
    const document = extractIdentityDocument(Object.keys(liveDidit).length ? liveDidit : localPayload, {
      documentType,
      documentTypeKey,
      fullName,
    });
    const documentFingerprint = await buildIdentityDocumentFingerprint(Object.keys(liveDidit).length ? liveDidit : localPayload, {
      documentType,
      documentTypeKey,
      fullName,
    });

    if (document.expiry && document.expiry < new Date().toISOString().slice(0, 10))
      throw new Error("Your identity document has expired. Register again using a current document.");
    let finalIdentityStatus = resolvedStatus === "APPROVED" ? "APPROVED" : "PENDING_REVIEW";
    let duplicateIdentity = { hasDuplicate: false, matches: [] };
    if (documentFingerprint) {
      duplicateIdentity = await findDuplicateIdentityClaim(supabaseAdmin, {
        documentFingerprint,
        role: identityRole,
        email,
      });
      if (duplicateIdentity.hasDuplicate) finalIdentityStatus = "PENDING_REVIEW";
    }

    const authUser = await ensureSignupAuthUser(supabaseAdmin, {
      email,
      password,
      identityRole,
      appRole,
      fullName,
      identityStatus: finalIdentityStatus,
      diditSessionId,
      documentType,
      documentTypeKey,
    });

    const profilePayload = buildProfilePayload({
      user: authUser,
      email,
      fullName,
      appRole,
      identityRole,
      identityStatus: finalIdentityStatus,
      diditSessionId,
      idDocumentExpiry: document.expiry || null,
      location,
    });

    const reviewPayload = {
      documentType, documentTypeKey, documentFingerprint,
      source: duplicateIdentity.hasDuplicate ? "DIDIT_DUPLICATE" : "DIDIT_PENDING",
      duplicateReason: duplicateIdentity.hasDuplicate ? "Another account has a matching identity document." : null,
      duplicateMatchCount: duplicateIdentity.matches.length,
      metadata: { diditVerificationData, consent: { identity: true, terms: true, accepted_at: new Date().toISOString() } },
      verifiedFullLegalName: document.fullName, normalizedFullLegalName: document.normalizedFullName, birthDate: document.birthDate,
    };
    const { data: saved, error: saveError } = await supabaseAdmin.rpc("save_identity_registration", {
      p_user_id: authUser.id, p_profile: profilePayload, p_review: reviewPayload,
      p_claim: { ...reviewPayload, source: finalIdentityStatus === "APPROVED" ? "DIDIT" : reviewPayload.source },
      p_session_id: diditSessionId, p_session_data: { verification_data: diditVerificationData },
    });
    if (saveError) throw new Error("The registration could not be saved. Retry verification status.");
    const manualReview = { id: saved?.manualReviewId || null };

    const emailDelivery = finalIdentityStatus === "APPROVED"
      ? await sendEmailConfirmation(email, redirectTo)
      : buildDeferredEmailDelivery(finalIdentityStatus);

    await updateRegistrationAttempt(supabaseAdmin, attemptId, {
      success: true,
      user_id: authUser.id,
      didit_session_id: diditSessionId,
      metadata: { identityRole, appRole, identityStatus: finalIdentityStatus },
    });

    return jsonResponse({
      success: true,
      userId: authUser.id,
      identityStatus: finalIdentityStatus,
      verificationStatus: finalIdentityStatus,
      emailConfirmationRequired: finalIdentityStatus === "APPROVED",
      emailConfirmationDeferred: finalIdentityStatus !== "APPROVED",
      emailDelivery,
      manualReviewId: manualReview?.id || null,
      autoApproved: false,
      message: finalIdentityStatus === "APPROVED"
        ? "Identity approved. Confirm your email before logging in."
        : "Your account was created and is waiting for identity review.",
    });
  } catch (error) {
    console.error("create_unverified_user_failed", error);
    const message = error instanceof Error ? error.message : "Unable to create identity-gated account.";
    return jsonResponse({ success: false, error: message }, error instanceof RegistrationRateLimitError ? 429 : 200);
  }
});
