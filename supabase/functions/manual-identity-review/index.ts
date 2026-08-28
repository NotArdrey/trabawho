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
  jsonResponse,
  normalizeAppRole,
  normalizeEmail,
  normalizeIdentityRole,
  parseJsonBody,
  queueManualIdentityReview,
  recordRegistrationAttempt,
  RegistrationRateLimitError,
  upsertIdentityDocumentClaim,
  updateRegistrationAttempt,
} from "../_shared/identityRegistration.ts";

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
  { email, password, role, appRole, fullName, documentType, documentTypeKey, idDocumentExpiry }: Record<string, unknown>,
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await parseJsonBody(req);
    const action = cleanString(body?.action);
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

    if (!email || !password || !fullName || !documentType || !identityDocumentNumber) {
      return jsonResponse({ success: false, error: "Email, password, full name, document type, and ID number are required." });
    }
    if (password.length < 8) return jsonResponse({ success: false, error: "Password must be at least 8 characters." });

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
