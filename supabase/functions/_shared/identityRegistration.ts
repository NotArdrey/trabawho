// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-signature-v2, x-signature-simple, x-timestamp",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TERMINAL_STATUSES = new Set(["DECLINED", "ABANDONED", "EXPIRED", "SUPERSEDED"]);
const ACTIVE_STATUSES = new Set(["PENDING", "NOT_STARTED", "IN_PROGRESS", "PROCESSING", "SUBMITTED", "STARTED", "CREATED"]);
const PUBLIC_IDENTITY_ROLES = new Set(["fan", "musician"]);
const PUBLIC_APP_ROLES = new Set(["client", "worker"]);

const SENSITIVE_ID_KEY = /(^|_)(document|doc|id|identity|identification|passport|license|licence|national|tax|tin|ssn|mrz)(_|$).*?(number|no|num|code|value|identifier|id)$|^(mrz|raw_mrz|document_number|documentnumber|id_number|idnumber|personal_number|personalnumber|passport_number|passportnumber|license_number|licensenumber|national_id_number|nationalidnumber)$/i;

export class RegistrationRateLimitError extends Error {
  status = 429;

  constructor(message = "Too many registration attempts. Please wait before trying again.") {
    super(message);
    this.name = "RegistrationRateLimitError";
  }
}

export const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

export const cleanString = (value: unknown) => String(value ?? "").trim();

export const normalizeEmail = (value: unknown) => cleanString(value).toLowerCase();

export const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanString(value));

export const normalizeIdentityRole = (value: unknown, fallback = "fan") => {
  const role = cleanString(value).toLowerCase();
  return PUBLIC_IDENTITY_ROLES.has(role) ? role : fallback;
};

export const normalizeAppRole = (value: unknown, fallback = "client") => {
  const role = cleanString(value).toLowerCase();
  if (PUBLIC_APP_ROLES.has(role)) return role;
  return normalizeIdentityRole(value) === "musician" ? "worker" : fallback;
};

export const appRoleFromIdentityRole = (value: unknown) =>
  normalizeIdentityRole(value) === "musician" ? "worker" : "client";

export const identityRoleFromAppRole = (value: unknown) =>
  normalizeAppRole(value) === "worker" ? "musician" : "fan";

export const normalizeStatus = (value: unknown) => {
  const normalized = cleanString(value).replace(/[\s-]+/g, "_").toUpperCase();
  if (!normalized) return "";
  if (normalized === "APPROVED") return "APPROVED";
  if (["DECLINED", "REJECTED", "DENIED"].includes(normalized)) return "DECLINED";
  if (["ABANDONED", "EXPIRED", "CANCELLED", "CANCELED", "KYC_EXPIRED"].includes(normalized)) {
    return normalized === "EXPIRED" ? "EXPIRED" : "ABANDONED";
  }
  if (["IN_REVIEW", "PENDING_REVIEW", "PENDING_REVIEW_REQUIRED", "MANUAL_REVIEW", "PENDING_MANUAL_REVIEW", "REVIEW"].includes(normalized)) {
    return "PENDING_REVIEW";
  }
  if (ACTIVE_STATUSES.has(normalized)) return "PENDING";
  return normalized;
};

export const isTerminalStatus = (value: unknown) => TERMINAL_STATUSES.has(normalizeStatus(value));

export const isApprovedOrReviewStatus = (value: unknown) => {
  const status = normalizeStatus(value);
  return status === "APPROVED" || status === "PENDING_REVIEW";
};

export const firstString = (values: unknown[]) => {
  for (const value of values) {
    const text = cleanString(value);
    if (text) return text;
  }
  return "";
};

export const parseJsonBody = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

export const createAdminClient = () => {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const getClientIp = (req: Request) => {
  const forwardedFor = cleanString(req.headers.get("x-forwarded-for"));
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return firstString([
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("fly-client-ip"),
  ]);
};

const getDeviceSignal = (req: Request) =>
  firstString([
    req.headers.get("x-device-id"),
    req.headers.get("x-installation-id"),
    req.headers.get("user-agent"),
  ]);

const getHashSecret = () =>
  firstString([
    Deno.env.get("IDENTITY_DOCUMENT_HASH_SECRET"),
    Deno.env.get("DIDIT_SESSION_NONCE_SECRET"),
    Deno.env.get("REGISTRATION_RATE_LIMIT_SECRET"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ]);

export const sha256Hex = async (message: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const hmacSha256Hex = async (message: string, explicitSecret = "") => {
  const secret = explicitSecret || getHashSecret();
  if (!secret) throw new Error("A hashing secret is required.");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
};

export const createSessionNonce = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const hashSessionNonce = async (sessionRef: unknown, nonce: unknown) => {
  const ref = cleanString(sessionRef);
  const value = cleanString(nonce);
  if (!ref || !value) return "";
  return hmacSha256Hex(`${ref}:${value}`);
};

export const verifySessionNonce = async (sessionRef: unknown, nonce: unknown, expectedHash: unknown) => {
  const expected = cleanString(expectedHash).toLowerCase();
  if (!expected) return false;

  const ref = cleanString(sessionRef);
  const value = cleanString(nonce);
  if (!ref || !value) return false;

  const secrets = [
    Deno.env.get("DIDIT_SESSION_NONCE_SECRET"),
    Deno.env.get("IDENTITY_DOCUMENT_HASH_SECRET"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ].map(cleanString).filter(Boolean);

  for (const secret of secrets) {
    const actual = await hmacSha256Hex(`${ref}:${value}`, secret);
    if (constantTimeEqual(actual, expected)) return true;
  }

  return false;
};

const getPath = (source: any, path: string[]) =>
  path.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);

const firstPathValue = (source: any, paths: string[][]) => {
  for (const path of paths) {
    const value = getPath(source, path);
    if (value !== undefined && value !== null && cleanString(value)) return value;
  }
  return "";
};

export const findDecisionObject = (source: any) => {
  const candidates = [
    source?.decision,
    source?.verification_data?.decision,
    source?.details?.decision,
    source?.result?.decision,
    source,
  ];

  return candidates.find((candidate) => (
    candidate
    && typeof candidate === "object"
    && (Array.isArray(candidate.id_verifications) || Array.isArray(candidate.face_matches))
  )) || null;
};

export const resolveSourceStatus = (source: any) => {
  if (!source || typeof source !== "object") return "";
  return normalizeStatus(
    source.status
    || source.verification_status
    || source.businessStatus
    || source.verification_data?.status
    || source.session?.status
    || source.result?.status
    || source.decision?.status,
  );
};

export const resolveDiditDecisionStatus = (source: any) => {
  const sourceStatus = resolveSourceStatus(source);
  const decision = findDecisionObject(source);
  if (!decision) return sourceStatus;

  const idVerification = decision.id_verifications?.[0];
  const faceMatch = decision.face_matches?.[0];
  const idStatus = normalizeStatus(idVerification?.status);
  const faceStatus = normalizeStatus(faceMatch?.status);

  if (idStatus === "DECLINED" || faceStatus === "DECLINED") return "DECLINED";
  if (idStatus === "ABANDONED" || faceStatus === "ABANDONED") return "ABANDONED";
  if (idStatus === "PENDING_REVIEW" || faceStatus === "PENDING_REVIEW") return "PENDING_REVIEW";
  if (idStatus === "APPROVED" && !faceMatch) {
    return sourceStatus === "PENDING_REVIEW" ? "PENDING_REVIEW" : "PENDING";
  }
  if (idStatus === "APPROVED" && faceStatus === "APPROVED") return "APPROVED";

  return normalizeStatus(decision.status) || sourceStatus || "PENDING";
};

const normalizeDocumentToken = (value: unknown) =>
  cleanString(value).toUpperCase().replace(/[^A-Z0-9]/g, "");

const normalizeIdentityNameToken = (value: unknown) =>
  cleanString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDateToken = (value: unknown) => {
  const text = cleanString(value);
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const normalized = `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    const parsed = new Date(`${normalized}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : "";
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

export const extractIdentityDocument = (source: any, fallback: Record<string, unknown> = {}) => {
  const decision = findDecisionObject(source) || source;
  const idVerification = decision?.id_verifications?.[0] || source?.id_verification || source?.idVerification || source;
  const raw = idVerification?.ocr_data || idVerification?.extracted_data || idVerification?.document || idVerification?.document_details || idVerification || source;

  const documentNumber = firstString([
    fallback.documentNumber,
    firstPathValue(raw, [
      ["document_number"],
      ["documentNumber"],
      ["id_number"],
      ["idNumber"],
      ["personal_number"],
      ["passport_number"],
      ["license_number"],
      ["national_id_number"],
      ["extra_fields", "document_number"],
      ["extra_fields", "id_number"],
    ]),
  ]);

  const documentType = firstString([
    fallback.documentTypeKey,
    fallback.documentType,
    idVerification?.document_type,
    raw?.document_type,
    raw?.documentType,
    raw?.type,
  ]).toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  const documentCountry = firstString([
    fallback.documentCountry,
    idVerification?.issuing_country,
    raw?.issuing_country,
    raw?.issuingCountry,
    raw?.country,
  ]).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "PHL";

  const expiry = normalizeDateToken(firstString([
    fallback.idDocumentExpiry,
    idVerification?.expiration_date,
    idVerification?.expiry_date,
    idVerification?.date_of_expiry,
    raw?.expiration_date,
    raw?.expiry_date,
    raw?.date_of_expiry,
    raw?.valid_until,
  ]));

  const fullName = firstString([
    fallback.fullName,
    raw?.full_name,
    raw?.fullName,
    raw?.name,
    [raw?.first_name || raw?.firstName, raw?.middle_name || raw?.middleName, raw?.last_name || raw?.lastName].filter(Boolean).join(" "),
  ]);

  const birthDate = normalizeDateToken(firstString([
    raw?.date_of_birth,
    raw?.dateOfBirth,
    raw?.birth_date,
    raw?.birthDate,
    raw?.dob,
  ]));

  return {
    documentNumber,
    documentType,
    documentCountry,
    expiry,
    fullName,
    normalizedFullName: normalizeIdentityNameToken(fullName),
    birthDate,
  };
};

export const buildIdentityDocumentFingerprint = async (source: any, fallback: Record<string, unknown> = {}) => {
  const document = extractIdentityDocument(source, fallback);
  const documentNumber = normalizeDocumentToken(document.documentNumber);
  const documentType = cleanString(document.documentType || fallback.documentTypeKey || fallback.documentType).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const documentCountry = cleanString(document.documentCountry || fallback.documentCountry || "PHL").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "PHL";

  if (documentNumber && documentType && documentCountry) {
    return `v1:${await hmacSha256Hex(`${documentCountry}|${documentType}|${documentNumber}`)}`;
  }

  const normalizedName = normalizeIdentityNameToken(document.fullName || fallback.fullName);
  const birthDate = normalizeDateToken(document.birthDate || fallback.birthDate);
  if (!normalizedName || !birthDate) return null;

  return `v1:${await hmacSha256Hex(`${documentCountry}|${documentType || "document"}|NAME_DOB|${normalizedName}|${birthDate}`)}`;
};

export const sanitizeIdentityVerificationData = (value: any, depth = 0): any => {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.map((item) => sanitizeIdentityVerificationData(item, depth + 1));
  if (!value || typeof value !== "object") return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_ID_KEY.test(key)
      ? "[redacted]"
      : sanitizeIdentityVerificationData(nestedValue, depth + 1);
  }
  return sanitized;
};

export const findAuthUserByEmail = async (supabaseAdmin: any, email: string) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const user = (data?.users || []).find((item: any) => normalizeEmail(item?.email) === normalizedEmail);
    if (user) return user;
    if ((data?.users || []).length < 1000) break;
  }

  return null;
};

export const findProfileByEmail = async (supabaseAdmin: any, email: string) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, role, account_status, identity_required, identity_role, is_verified, verification_status, didit_session_id")
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
};

export const assertPublicSignupAllowed = (profile: any, requestedAppRole = "client") => {
  if (!profile) return;

  const profileRole = cleanString(profile.role).toLowerCase();
  const accountStatus = cleanString(profile.account_status || "active").toLowerCase();
  const verificationStatus = normalizeStatus(profile.verification_status || (profile.identity_required ? "PENDING" : "LEGACY"));

  if (profileRole === "admin") {
    throw new Error("Admin accounts cannot be created or retried through public registration.");
  }

  if (accountStatus === "disabled" || accountStatus === "suspended") {
    throw new Error("This account cannot start public registration right now. Please contact support.");
  }

  if (profileRole && PUBLIC_APP_ROLES.has(profileRole) && profileRole !== normalizeAppRole(requestedAppRole)) {
    throw new Error("This email is already registered with another account type.");
  }

  if (profile.is_verified === true || verificationStatus === "APPROVED") {
    throw new Error("This email is already registered and verified. Please log in.");
  }

  if (!TERMINAL_STATUSES.has(verificationStatus)) {
    throw new Error("This email already has an active registration or review.");
  }
};

export const findDuplicateIdentityClaim = async (
  supabaseAdmin: any,
  { documentFingerprint, role, userId = "", email = "" }: Record<string, unknown>,
) => {
  const fingerprint = cleanString(documentFingerprint);
  if (!fingerprint) return { hasDuplicate: false, matches: [] };

  let query = supabaseAdmin
    .from("identity_document_claims")
    .select("id, user_id, role, status, normalized_email")
    .eq("document_fingerprint", fingerprint)
    .eq("role", normalizeIdentityRole(role))
    .in("status", ["APPROVED", "PENDING_REVIEW"])
    .limit(10);

  if (isUuid(userId)) query = query.neq("user_id", userId);

  const { data, error } = await query;
  if (error) throw error;

  const normalizedEmail = normalizeEmail(email);
  const matches = (data || []).filter((item: any) => {
    const claimEmail = normalizeEmail(item.normalized_email);
    return !normalizedEmail || !claimEmail || claimEmail !== normalizedEmail;
  });

  return { hasDuplicate: matches.length > 0, matches };
};

export const upsertIdentityDocumentClaim = async (
  supabaseAdmin: any,
  {
    userId,
    role,
    appRole,
    documentFingerprint,
    documentType,
    documentTypeKey,
    documentCountry = "PHL",
    source = "DIDIT",
    status = "APPROVED",
    diditSessionId = null,
    manualReviewId = null,
    email = null,
    metadata = {},
    verifiedFullLegalName = null,
    normalizedFullLegalName = null,
    birthDate = null,
  }: Record<string, unknown>,
) => {
  if (!isUuid(userId)) return null;

  const payload = {
    user_id: userId,
    role: normalizeIdentityRole(role),
    app_role: normalizeAppRole(appRole),
    document_fingerprint: cleanString(documentFingerprint) || null,
    original_user_id: userId,
    normalized_email: normalizeEmail(email),
    document_type: cleanString(documentType) || "Government ID",
    document_type_key: cleanString(documentTypeKey) || null,
    document_country: cleanString(documentCountry).toUpperCase() || "PHL",
    source,
    status,
    didit_session_id: cleanString(diditSessionId) || null,
    manual_review_id: cleanString(manualReviewId) || null,
    claim_metadata: metadata && typeof metadata === "object" ? metadata : {},
    verified_full_legal_name: cleanString(verifiedFullLegalName) || null,
    normalized_full_legal_name: cleanString(normalizedFullLegalName) || null,
    birth_date: cleanString(birthDate) || null,
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };

  let existingClaim = null;
  if (cleanString(documentFingerprint)) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("identity_document_claims")
      .select("id")
      .eq("user_id", userId)
      .eq("document_fingerprint", cleanString(documentFingerprint))
      .eq("role", normalizeIdentityRole(role))
      .maybeSingle();
    if (existingError && existingError.code !== "PGRST116") throw existingError;
    existingClaim = existing;
  }

  const query = existingClaim?.id
    ? supabaseAdmin.from("identity_document_claims").update(payload).eq("id", existingClaim.id)
    : supabaseAdmin.from("identity_document_claims").insert(payload);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  return data;
};

export const queueManualIdentityReview = async (
  supabaseAdmin: any,
  {
    userId,
    email,
    role,
    appRole,
    documentType,
    documentTypeKey,
    documentCountry = "PHL",
    source = "DIDIT_PENDING",
    diditSessionId = null,
    documentFingerprint = null,
    duplicateReason = null,
    duplicateMatchCount = 0,
    metadata = {},
    verifiedFullLegalName = null,
    normalizedFullLegalName = null,
    birthDate = null,
    frontImagePath = null,
    backImagePath = null,
    selfieImagePath = null,
  }: Record<string, unknown>,
) => {
  if (!isUuid(userId)) return null;

  const normalizedSource = cleanString(source).toUpperCase() || "DIDIT_PENDING";
  const nowIso = new Date().toISOString();
  const payload = {
    user_id: userId,
    submitted_by_email: normalizeEmail(email),
    submitted_role: normalizeIdentityRole(role),
    submitted_app_role: normalizeAppRole(appRole),
    document_type: cleanString(documentType) || "Government ID",
    document_type_key: cleanString(documentTypeKey) || null,
    document_country: cleanString(documentCountry).toUpperCase() || "PHL",
    source: normalizedSource,
    status: "PENDING_REVIEW",
    didit_session_id: cleanString(diditSessionId) || null,
    document_fingerprint: cleanString(documentFingerprint) || null,
    duplicate_reason: cleanString(duplicateReason) || null,
    duplicate_match_count: Number(duplicateMatchCount || 0),
    review_notes: cleanString(duplicateReason) || null,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    verified_full_legal_name: cleanString(verifiedFullLegalName) || null,
    normalized_full_legal_name: cleanString(normalizedFullLegalName) || null,
    birth_date: cleanString(birthDate) || null,
    front_image_path: cleanString(frontImagePath) || null,
    back_image_path: cleanString(backImagePath) || null,
    selfie_image_path: cleanString(selfieImagePath) || null,
    expected_decision_by: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: nowIso,
  };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("manual_identity_reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "PENDING_REVIEW")
    .eq("source", normalizedSource)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") throw existingError;

  const query = existing?.id
    ? supabaseAdmin.from("manual_identity_reviews").update(payload).eq("id", existing.id)
    : supabaseAdmin.from("manual_identity_reviews").insert(payload);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  return data;
};

export const recordRegistrationAttempt = async (
  supabaseAdmin: any,
  req: Request,
  {
    action,
    email,
    userId = null,
    diditSessionId = null,
    metadata = {},
    success = false,
    reason = null,
    limits = {},
  }: Record<string, unknown>,
) => {
  const normalizedAction = cleanString(action);
  const resolvedLimits = {
    hourlyEmail: normalizedAction === "manual_identity_review" ? 3 : 12,
    hourlyIp: normalizedAction === "manual_identity_review" ? 8 : 40,
    ...limits,
  };

  const [emailHash, ipHash, deviceHash] = await Promise.all([
    normalizeEmail(email) ? hmacSha256Hex(`email:${normalizeEmail(email)}`).then((value) => `v1:${value}`) : null,
    getClientIp(req) ? hmacSha256Hex(`ip:${getClientIp(req).toLowerCase()}`).then((value) => `v1:${value}`) : null,
    getDeviceSignal(req) ? hmacSha256Hex(`device:${getDeviceSignal(req).toLowerCase()}`).then((value) => `v1:${value}`) : null,
  ]);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const checks = [
    emailHash ? { column: "email_hash", value: emailHash, limit: resolvedLimits.hourlyEmail } : null,
    ipHash ? { column: "ip_hash", value: ipHash, limit: resolvedLimits.hourlyIp } : null,
  ].filter(Boolean);

  for (const check of checks) {
    const { count, error } = await supabaseAdmin
      .from("registration_attempts")
      .select("id", { count: "exact", head: true })
      .eq("action", normalizedAction)
      .eq(check.column, check.value)
      .gte("created_at", oneHourAgo);

    if (!error && check.limit && (count || 0) >= check.limit) {
      await supabaseAdmin.from("registration_attempts").insert({
        action: normalizedAction,
        email_hash: emailHash,
        ip_hash: ipHash,
        device_hash: deviceHash,
        user_id: isUuid(userId) ? userId : null,
        didit_session_id: cleanString(diditSessionId) || null,
        blocked: true,
        success: false,
        reason: `${check.column}_hourly_limit`,
        metadata: metadata && typeof metadata === "object" ? metadata : {},
      });
      throw new RegistrationRateLimitError();
    }
  }

  const { data, error } = await supabaseAdmin
    .from("registration_attempts")
    .insert({
      action: normalizedAction,
      email_hash: emailHash,
      ip_hash: ipHash,
      device_hash: deviceHash,
      user_id: isUuid(userId) ? userId : null,
      didit_session_id: cleanString(diditSessionId) || null,
      blocked: false,
      success,
      reason,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("registration_attempt_record_failed", { action: normalizedAction, message: error.message });
    return null;
  }
  return data?.id || null;
};

export const updateRegistrationAttempt = async (supabaseAdmin: any, attemptId: unknown, updates: Record<string, unknown>) => {
  const id = cleanString(attemptId);
  if (!id) return;
  const { error } = await supabaseAdmin
    .from("registration_attempts")
    .update(updates)
    .eq("id", id);
  if (error) console.error("registration_attempt_update_failed", { message: error.message });
};

export const buildProfilePayload = ({
  user,
  email,
  fullName,
  appRole,
  identityRole,
  identityStatus,
  diditSessionId = null,
  idDocumentExpiry = null,
}: Record<string, unknown>) => {
  const resolvedAppRole = normalizeAppRole(appRole);
  const resolvedIdentityStatus = normalizeStatus(identityStatus) || "PENDING_REVIEW";
  const isApproved = resolvedIdentityStatus === "APPROVED";
  return {
    user_id: user?.id || user,
    email: normalizeEmail(email || user?.email),
    full_name: cleanString(fullName) || normalizeEmail(email || user?.email).split("@")[0] || "TrabaWho User",
    is_client: true,
    is_worker: resolvedAppRole === "worker",
    role: resolvedAppRole,
    account_status: "active",
    identity_required: true,
    identity_role: normalizeIdentityRole(identityRole),
    is_verified: isApproved,
    verification_status: resolvedIdentityStatus,
    didit_session_id: cleanString(diditSessionId) || null,
    id_document_expiry: cleanString(idDocumentExpiry) || null,
    id_verified_at: isApproved ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
};

export const sendEmailConfirmation = async (email: string, redirectTo = "") => {
  const supabaseUrl = Deno.env.get("TRABAWHO_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("TRABAWHO_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) {
    return { sent: false, provider: "supabase_auth", error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/resend`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "signup",
        email: normalizeEmail(email),
        options: redirectTo ? { email_redirect_to: redirectTo } : undefined,
      }),
    });

    if (response.ok) return { sent: true, provider: "supabase_auth" };
    const errorText = await response.text().catch(() => "");
    return { sent: false, provider: "supabase_auth", error: errorText.slice(0, 500) };
  } catch (error) {
    return { sent: false, provider: "supabase_auth", error: error instanceof Error ? error.message : String(error) };
  }
};

export const buildDeferredEmailDelivery = (identityStatus: string) => ({
  sent: false,
  provider: "identity_review",
  skipped: true,
  reason: normalizeStatus(identityStatus) === "PENDING_REVIEW" ? "identity_pending_review" : "identity_not_approved",
});
