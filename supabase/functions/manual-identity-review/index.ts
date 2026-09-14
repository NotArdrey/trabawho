// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  buildDeferredEmailDelivery,
  buildIdentityDocumentFingerprint,
  buildProfilePayload,
  cleanString,
  corsHeaders,
  createAdminClient,
  assertPublicSignupAllowed,
  findAuthUserByEmail,
  findProfileByEmail,
  findDuplicateIdentityClaim,
  firstString,
  jsonResponse,
  normalizeAppRole,
  normalizeEmail,
  normalizeIdentityRole,
  parseJsonBody,
  queueManualIdentityReview,
  recordRegistrationAttempt,
  RegistrationRateLimitError,
  sendEmailConfirmation,
  upsertIdentityDocumentClaim,
  updateRegistrationAttempt,
} from "../_shared/identityRegistration.ts";
import {
  assertCompleteRegistrationDetails,
  normalizeRegistrationDetails,
} from "../_shared/registrationDetails.ts";
const IDENTITY_BUCKET = "identity-manual";
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const normalizeBase64 = (input: string) => (input.includes(",") ? input.split(",").pop() || "" : input).replace(/\s/g, "");

const estimateBase64Bytes = (base64Value: string) => {
  const normalized = normalizeBase64(base64Value);
  const padding = (normalized.match(/=/g) || []).length;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};
const decodeBase64 = (base64Value: string) => {
  const binary = atob(normalizeBase64(base64Value));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};
const sanitizePathPart = (value: unknown, fallback: string) =>
  cleanString(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;

const normalizeImagePayload = (raw: any, label: string) => {
  const base64 = cleanString(raw?.base64);
  if (!base64) throw new Error(`${label} image is required.`);

  const estimatedBytes = estimateBase64Bytes(base64);
  if (estimatedBytes <= 0 || estimatedBytes > MAX_IMAGE_BYTES) {
    throw new Error(`${label} image exceeds the 7MB limit.`);
  }

  const mimeType = cleanString(raw?.mimeType || "image/jpeg").toLowerCase();
  if (!mimeType.startsWith("image/")) throw new Error(`${label} file must be an image.`);

  const extension = sanitizePathPart(raw?.extension || mimeType.split("/").pop() || "jpg", "jpg").replace(/^\./, "");
  return {
    base64,
    mimeType,
    extension,
    fileName: sanitizePathPart(raw?.fileName || `${label}.${extension}`, `${label}.${extension}`),
  };
};

const uploadImage = async (supabaseAdmin: any, userId: string, slot: string, rawPayload: any) => {
  const payload = normalizeImagePayload(rawPayload, slot);
  const bytes = decodeBase64(payload.base64);
  const path = `${sanitizePathPart(userId, "user")}/${Date.now()}-${slot}-${payload.fileName}`;

  const { error } = await supabaseAdmin.storage
    .from(IDENTITY_BUCKET)
    .upload(path, bytes, {
      contentType: payload.mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Failed to upload ${slot} image: ${error.message}`);
  return path;
};

const ensureBucket = async (supabaseAdmin: any) => {
  const { data } = await supabaseAdmin.storage.getBucket(IDENTITY_BUCKET);
  if (data?.id) return;

  const { error } = await supabaseAdmin.storage.createBucket(IDENTITY_BUCKET, {
    public: false,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error && !/already exists/i.test(error.message || "")) {
    console.warn("identity_manual_bucket_create_failed", { message: error.message });
  }
};

const ensureManualReviewAuthUser = async (
  supabaseAdmin: any,
  { email, password, role, appRole, fullName, documentType, documentTypeKey, idDocumentExpiry, registrationDetails }: Record<string, unknown>,
) => {
  const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
  const metadata = {
    ...(existingUser?.user_metadata || {}),
    role: normalizeAppRole(appRole),
    identity_role: normalizeIdentityRole(role),
    verification_status: "PENDING_REVIEW",
    identity_required: true,
    is_verified: false,
    full_name: cleanString(fullName) || normalizeEmail(email).split("@")[0] || "TrabaWho User",
    selected_document_type: documentType,
    selected_document_type_key: documentTypeKey,
    verification_mode: "manual_upload",
    id_document_expiry: cleanString(idDocumentExpiry),
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
    if (error || !data?.user) throw new Error(error?.message || "Unable to update existing manual review user.");
    return data.user;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizeEmail(email),
    password: cleanString(password),
    email_confirm: false,
    user_metadata: metadata,
  });

  if (error || !data?.user) throw new Error(error?.message || "Unable to create manual review account.");
  return data.user;
};

const validateDate = (value: unknown) => {
  const text = cleanString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("ID expiry date must use YYYY-MM-DD format.");
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error("ID expiry date is invalid.");
  }
  if (text < new Date().toISOString().slice(0, 10)) {
    throw new Error("ID expiry date cannot be in the past.");
  }
  return text;
};

const requireAdminUser = async (req: Request, supabaseAdmin: any) => {
  const authorization = cleanString(req.headers.get("authorization"));
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("Administrator authentication is required.");

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData?.user?.id) throw new Error("Administrator authentication is required.");

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, account_status")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (profileError || cleanString(profile?.role).toLowerCase() !== "admin" || cleanString(profile?.account_status).toLowerCase() !== "active") {
    throw new Error("Administrator access is required.");
  }

  return authData.user;
};

const createReviewImageUrl = async (supabaseAdmin: any, path: unknown) => {
  const storagePath = cleanString(path);
  if (!storagePath) return null;
  const { data, error } = await supabaseAdmin.storage.from(IDENTITY_BUCKET).createSignedUrl(storagePath, 10 * 60);
  if (error) return null;
  return data?.signedUrl || null;
};

const handleListIdentityReviews = async (req: Request) => {
  const supabaseAdmin = createAdminClient();
  await requireAdminUser(req, supabaseAdmin);

  const { data: reviews, error } = await supabaseAdmin
    .from("manual_identity_reviews")
    .select("id, user_id, submitted_by_email, submitted_app_role, document_type, document_type_key, source, status, front_image_path, back_image_path, selfie_image_path, didit_session_id, duplicate_reason, duplicate_match_count, metadata, name_on_id, id_number, id_expiry_date, expected_decision_by, created_at")
    .eq("status", "PENDING_REVIEW")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const userIds = [...new Set((reviews || []).map((review: any) => cleanString(review.user_id)).filter(Boolean))];
  const { data: profiles, error: profileError } = userIds.length
    ? await supabaseAdmin
      .from("profiles")
      .select("user_id, email, role, province, city, barangay, address, verification_status, is_verified")
      .in("user_id", userIds)
    : { data: [], error: null };
  if (profileError) throw profileError;

  const profilesByUserId = Object.fromEntries((profiles || []).map((profile: any) => [profile.user_id, profile]));
  const queue = await Promise.all((reviews || []).map(async (review: any) => {
    const profile = profilesByUserId[review.user_id] || {};
    const [frontImageUrl, backImageUrl, selfieImageUrl] = await Promise.all([
      createReviewImageUrl(supabaseAdmin, review.front_image_path),
      createReviewImageUrl(supabaseAdmin, review.back_image_path),
      createReviewImageUrl(supabaseAdmin, review.selfie_image_path),
    ]);

    return {
      id: review.id,
      userId: review.user_id,
      source: review.source,
      status: review.status,
      submittedAt: review.created_at,
      expectedDecisionBy: review.expected_decision_by,
      accountType: review.submitted_app_role || profile.role || "client",
      email: review.submitted_by_email || profile.email || "",
      location: {
        province: profile.province || "",
        city: profile.city || "",
        barangay: profile.barangay || "",
        address: profile.address || "",
      },
      identity: {
        documentType: review.document_type,
        documentTypeKey: review.document_type_key,
        nameOnId: review.name_on_id,
        idNumber: review.id_number,
        expiryDate: review.id_expiry_date,
        diditSessionId: review.didit_session_id,
        duplicateReason: review.duplicate_reason,
        duplicateMatchCount: review.duplicate_match_count,
        diditResult: review.source === "MANUAL_UPLOAD" ? null : review.metadata,
        frontImageUrl,
        backImageUrl,
        selfieImageUrl,
      },
    };
  }));

  return jsonResponse({ success: true, reviews: queue });
};

const handleIdentityReviewDecision = async (req: Request, body: any) => {
  const supabaseAdmin = createAdminClient();
  const adminUser = await requireAdminUser(req, supabaseAdmin);
  const reviewId = cleanString(body?.reviewId || body?.review_id);
  const decision = cleanString(body?.decision).toUpperCase();
  const note = cleanString(body?.note || body?.reviewNote);

  if (!reviewId) return jsonResponse({ success: false, error: "Review ID is required." });
  if (!["APPROVE", "REJECT", "RESUBMISSION"].includes(decision)) {
    return jsonResponse({ success: false, error: "Choose approve, reject, or resubmission." });
  }
  if (!note) return jsonResponse({ success: false, error: "A decision note is required." });

  const { data: review, error: reviewError } = await supabaseAdmin
    .from("manual_identity_reviews")
    .select("id, user_id, submitted_by_email, status")
    .eq("id", reviewId)
    .maybeSingle();
  if (reviewError || !review) throw reviewError || new Error("Identity review was not found.");
  if (review.status !== "PENDING_REVIEW") {
    return jsonResponse({ success: false, error: "This identity review already has a decision." });
  }
  if (!cleanString(review.user_id)) return jsonResponse({ success: false, error: "This identity review is not linked to a user account." });

  const nextStatus = decision === "APPROVE"
    ? "APPROVED"
    : decision === "RESUBMISSION" ? "RESUBMISSION_REQUIRED" : "DECLINED";
  const reviewedAt = new Date().toISOString();

  const { error: reviewUpdateError } = await supabaseAdmin
    .from("manual_identity_reviews")
    .update({
      status: nextStatus,
      review_notes: note,
      review_reason: decision,
      reviewed_by: adminUser.id,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq("id", review.id)
    .eq("status", "PENDING_REVIEW");
  if (reviewUpdateError) throw reviewUpdateError;

  const { error: profileUpdateError } = await supabaseAdmin
    .from("profiles")
    .update({
      verification_status: nextStatus,
      is_verified: nextStatus === "APPROVED",
      identity_reviewed_at: reviewedAt,
      id_verified_at: nextStatus === "APPROVED" ? reviewedAt : null,
      updated_at: reviewedAt,
    })
    .eq("user_id", review.user_id);
  if (profileUpdateError) throw profileUpdateError;

  await supabaseAdmin
    .from("identity_document_claims")
    .update({ status: nextStatus === "APPROVED" ? "APPROVED" : "DECLINED", updated_at: reviewedAt })
    .eq("manual_review_id", review.id);

  const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(review.user_id);
  if (authUserData?.user) {
    await supabaseAdmin.auth.admin.updateUserById(review.user_id, {
      user_metadata: {
        ...(authUserData.user.user_metadata || {}),
        verification_status: nextStatus,
        is_verified: nextStatus === "APPROVED",
      },
    });
  }

  const emailDelivery = nextStatus === "APPROVED"
    ? await sendEmailConfirmation(
      review.submitted_by_email,
      firstString([body?.redirectTo, body?.redirect_to, Deno.env.get("EMAIL_CONFIRM_REDIRECT_TO")]),
    )
    : { sent: false, skipped: true, reason: nextStatus.toLowerCase() };

  return jsonResponse({
    success: true,
    reviewId: review.id,
    verificationStatus: nextStatus,
    isVerified: nextStatus === "APPROVED",
    emailDelivery,
  });
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await parseJsonBody(req);
    const action = cleanString(body?.action);
    if (action === "list_identity_reviews") return await handleListIdentityReviews(req);
    if (action === "decide_identity_review") return await handleIdentityReviewDecision(req, body);
    if (action !== "submit_manual_review_signup") {
      return jsonResponse({ success: false, error: `Unsupported action: ${action}` });
    }

    const email = normalizeEmail(body?.email);
    const password = cleanString(body?.password);
    const role = normalizeIdentityRole(body?.role);
    const appRole = normalizeAppRole(body?.appRole || body?.app_role);
    const fullName = cleanString(body?.fullName || body?.manualFullName);
    const documentType = cleanString(body?.documentType || "Government ID");
    const documentTypeKey = cleanString(body?.documentTypeKey || "custom_document");
    const documentCountry = cleanString(body?.documentCountry || "PHL").toUpperCase();
    const idDocumentExpiry = validateDate(body?.idDocumentExpiry || body?.id_document_expiry);
    const identityDocumentNumber = cleanString(body?.identityDocumentNumber || body?.idDocumentNumber || body?.documentNumber);
    const registrationDetails = normalizeRegistrationDetails(body);

    if (!email || !password || !fullName || !documentType || !identityDocumentNumber) {
      return jsonResponse({ success: false, error: "Email, password, full name, document type, and ID number are required." });
    }
    if (password.length < 8) return jsonResponse({ success: false, error: "Password must be at least 8 characters." });
    assertCompleteRegistrationDetails(registrationDetails);

    const supabaseAdmin = createAdminClient();
    const existingProfile = await findProfileByEmail(supabaseAdmin, email);
    assertPublicSignupAllowed(existingProfile, appRole);
    await ensureBucket(supabaseAdmin);

    const attemptId = await recordRegistrationAttempt(supabaseAdmin, req, {
      action: "manual_identity_review",
      email,
      metadata: { role, appRole, documentTypeKey },
    });

    const documentFingerprint = await buildIdentityDocumentFingerprint(null, {
      documentNumber: identityDocumentNumber,
      documentType,
      documentTypeKey,
      documentCountry,
      fullName,
    });

    const duplicateIdentity = await findDuplicateIdentityClaim(supabaseAdmin, {
      documentFingerprint,
      role,
      email,
    });

    const authUser = await ensureManualReviewAuthUser(supabaseAdmin, {
      email,
      password,
      role,
      appRole,
      fullName,
      documentType,
      documentTypeKey,
      idDocumentExpiry,
      registrationDetails,
    });

    const [frontImagePath, backImagePath, selfieImagePath] = await Promise.all([
      uploadImage(supabaseAdmin, authUser.id, "front", body?.frontImage),
      uploadImage(supabaseAdmin, authUser.id, "back", body?.backImage),
      uploadImage(supabaseAdmin, authUser.id, "selfie", body?.selfieImage),
    ]);

    const profilePayload = buildProfilePayload({
      user: authUser,
      email,
      fullName,
      appRole,
      identityRole: role,
      identityStatus: "PENDING_REVIEW",
      idDocumentExpiry,
      documentTypeKey,
      verificationMethod: "MANUAL",
      ...registrationDetails,
    });

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "user_id" });
    if (profileError) throw new Error(`Unable to save profile: ${profileError.message}`);

    const duplicateReason = duplicateIdentity.hasDuplicate
      ? `This ID appears to match another ${role} account. We will review it manually.`
      : null;

    const review = await queueManualIdentityReview(supabaseAdmin, {
      userId: authUser.id,
      email,
      role,
      appRole,
      documentType,
      documentTypeKey,
      documentCountry,
      source: "MANUAL_UPLOAD",
      documentFingerprint,
      duplicateReason,
      duplicateMatchCount: duplicateIdentity.matches.length,
      metadata: {
        identity_document_number_present: true,
        duplicate_identity_review: duplicateIdentity.hasDuplicate,
      },
      verifiedFullLegalName: fullName,
      normalizedFullLegalName: fullName.toUpperCase(),
      frontImagePath,
      backImagePath,
      selfieImagePath,
      nameOnId: fullName,
      identityDocumentNumber,
      idDocumentExpiry,
    });

    await upsertIdentityDocumentClaim(supabaseAdmin, {
      userId: authUser.id,
      role,
      appRole,
      documentFingerprint,
      documentType,
      documentTypeKey,
      documentCountry,
      source: "MANUAL_UPLOAD",
      status: "PENDING_REVIEW",
      manualReviewId: review?.id || null,
      email,
      metadata: {
        identity_document_number_present: true,
      },
      verifiedFullLegalName: fullName,
      normalizedFullLegalName: fullName.toUpperCase(),
    });

    await updateRegistrationAttempt(supabaseAdmin, attemptId, {
      success: true,
      user_id: authUser.id,
      metadata: { role, appRole, reviewId: review?.id || null },
    });

    return jsonResponse({
      success: true,
      userId: authUser.id,
      manualReviewId: review?.id || null,
      identityStatus: "PENDING_REVIEW",
      emailConfirmationDeferred: true,
      emailDelivery: buildDeferredEmailDelivery("PENDING_REVIEW"),
      message: "Manual review submitted. Email confirmation will be sent after identity approval.",
    });
  } catch (error) {
    console.error("manual_identity_review_failed", error);
    const message = error instanceof Error ? error.message : "Unable to submit manual identity review.";
    return jsonResponse({ success: false, error: message }, error instanceof RegistrationRateLimitError ? 429 : 200);
  }
});
