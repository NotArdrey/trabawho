// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  appRoleFromIdentityRole,
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
  queueManualIdentityReview,
  recordRegistrationAttempt,
  RegistrationRateLimitError,
  resolveDiditDecisionStatus,
  sanitizeIdentityVerificationData,
  sendEmailConfirmation,
  upsertIdentityDocumentClaim,
  updateRegistrationAttempt,
  verifySessionNonce,
} from "../_shared/identityRegistration.ts";
import {
  assertCompleteRegistrationDetails,
  normalizeRegistrationDetails,
} from "../_shared/registrationDetails.ts";

const fetchLiveDiditDecision = async (sessionId: string) => {
  const diditApiKey = Deno.env.get("DIDIT_API_KEY") || "";
  if (!diditApiKey || !sessionId) return {};

  try {
    const response = await fetch(
      `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`,
      {
        method: "GET",
        headers: { "x-api-key": diditApiKey, Accept: "application/json" },
      },
    );
    if (!response.ok) {
      console.error("create_unverified_user_didit_lookup_failed", { sessionId, status: response.status });
      return {};
    }
    return await response.json();
  } catch (error) {
    console.error("create_unverified_user_didit_lookup_failed", {
      sessionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
};

const ensureSignupAuthUser = async (
  supabaseAdmin: any,
  { email, password, identityRole, appRole, fullName, identityStatus, diditSessionId, documentType, documentTypeKey, registrationDetails }: Record<string, unknown>,
) => {
  const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
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
    province: cleanString(registrationDetails?.province),
    city: cleanString(registrationDetails?.city),
    barangay: cleanString(registrationDetails?.barangay),
    address: cleanString(registrationDetails?.address),
    identity_verification_consent: registrationDetails?.identityVerificationConsent === true,
    data_privacy_consent: registrationDetails?.dataPrivacyConsent === true,
  };

  if (existingUser) {
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
    if (existingProfile) {
      const existingStatus = normalizeStatus(existingProfile.verification_status || (existingProfile.identity_required ? "PENDING" : "LEGACY"));
      const existingRole = cleanString(existingProfile.role).toLowerCase();
      if (existingRole === "admin") throw new Error("Admin accounts cannot use public registration.");
      if (existingProfile.is_verified || existingStatus === "APPROVED") {
        throw new Error("This email is already registered and verified. Please log in.");
      }
      if (!["DECLINED", "ABANDONED", "EXPIRED", "SUPERSEDED"].includes(existingStatus)) {
        throw new Error("This email already has an active registration or review.");
      }
    }

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

    const registrationDetails = normalizeRegistrationDetails(localSession.verification_data);
    assertCompleteRegistrationDetails(registrationDetails);

    const nonceHash = localSession?.verification_data?.session_nonce_hash;
    if (nonceHash && !(await verifySessionNonce(diditSessionId, sessionNonce, nonceHash))) {
      await updateRegistrationAttempt(supabaseAdmin, attemptId, { success: false, reason: "invalid_session_nonce" });
      return jsonResponse({ success: false, error: "Didit session could not be validated. Please restart identity verification." });
    }

    const storedEmail = normalizeEmail(localSession?.verification_data?.email);
    if (storedEmail && storedEmail !== email) {
      return jsonResponse({ success: false, error: "Didit session email does not match this signup." });
    }

    const liveDidit = await fetchLiveDiditDecision(diditSessionId);
    const localPayload = {
      ...localSession.verification_data,
      status: localSession.status,
    };
    const liveStatus = resolveDiditDecisionStatus(liveDidit);
    const localStatus = resolveDiditDecisionStatus(localPayload);
    const requestedStatus = normalizeStatus(body?.diditStatus);
    const resolvedStatus = liveStatus || localStatus || requestedStatus;

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
    const document = extractIdentityDocument(liveDidit || localPayload, {
      documentType,
      documentTypeKey,
      fullName,
    });
    const documentFingerprint = await buildIdentityDocumentFingerprint(liveDidit || localPayload, {
      documentType,
      documentTypeKey,
      fullName,
    });

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
      registrationDetails,
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
      documentTypeKey,
      verificationMethod: "DIDIT",
      ...registrationDetails,
    });

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "user_id" });
    if (profileError) throw new Error(`Unable to save profile: ${profileError.message}`);

    await supabaseAdmin
      .from("verification_sessions")
      .update({
        user_id: authUser.id,
        status: finalIdentityStatus,
        verification_data: {
          ...(localSession.verification_data || {}),
          status: finalIdentityStatus,
          account_user_id: authUser.id,
          verification_data: diditVerificationData,
          finalized_at: new Date().toISOString(),
        },
      })
      .eq("session_ref", diditSessionId);

    let manualReview = null;
    if (finalIdentityStatus === "PENDING_REVIEW") {
      const duplicateReason = duplicateIdentity.hasDuplicate
        ? `This ID appears to match another ${identityRole} account. We will review it manually.`
        : null;
      manualReview = await queueManualIdentityReview(supabaseAdmin, {
        userId: authUser.id,
        email,
        role: identityRole,
        appRole,
        documentType,
        documentTypeKey,
        source: duplicateIdentity.hasDuplicate ? "DIDIT_DUPLICATE" : "DIDIT_PENDING",
        diditSessionId,
        documentFingerprint,
        duplicateReason,
        duplicateMatchCount: duplicateIdentity.matches.length,
        metadata: { diditVerificationData },
        verifiedFullLegalName: document.fullName,
        normalizedFullLegalName: document.normalizedFullName,
        birthDate: document.birthDate,
      });
    }

    await upsertIdentityDocumentClaim(supabaseAdmin, {
      userId: authUser.id,
      role: identityRole,
      appRole,
      documentFingerprint,
      documentType,
      documentTypeKey,
      source: finalIdentityStatus === "APPROVED" ? "DIDIT" : "DIDIT_PENDING",
      status: finalIdentityStatus,
      diditSessionId,
      manualReviewId: manualReview?.id || null,
      email,
      metadata: { diditVerificationData },
      verifiedFullLegalName: document.fullName,
      normalizedFullLegalName: document.normalizedFullName,
      birthDate: document.birthDate,
    });

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
