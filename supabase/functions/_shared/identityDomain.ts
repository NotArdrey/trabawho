export type IdentityStatus = "PENDING" | "PENDING_REVIEW" | "APPROVED" | "DECLINED" | "ABANDONED" | "EXPIRED" | "SUPERSEDED";
export const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export function normalizeStatus(value: unknown): string {
  const status = text(value).replace(/[\s-]+/g, "_").toUpperCase();
  if (["IN_REVIEW", "PENDING_REVIEW", "MANUAL_REVIEW", "PENDING_MANUAL_REVIEW", "REVIEW"].includes(status)) return "PENDING_REVIEW";
  if (["REJECTED", "DENIED"].includes(status)) return "DECLINED";
  if (["KYC_EXPIRED", "EXPIRED"].includes(status)) return "EXPIRED";
  if (["CANCELLED", "CANCELED", "ABANDONED"].includes(status)) return "ABANDONED";
  if (["NOT_STARTED", "IN_PROGRESS", "PROCESSING", "SUBMITTED", "STARTED", "CREATED", "RESUBMITTED", "AWAITING_USER"].includes(status)) return "PENDING";
  return status;
}

export function findDecisionObject(source: unknown): Record<string, unknown> | null {
  const record = asRecord(source);
  const candidates = [record.decision, asRecord(record.verification_data).decision,
    asRecord(record.details).decision, asRecord(record.result).decision, source];
  return candidates.map(asRecord).find((candidate) =>
    Array.isArray(candidate.id_verifications) || Array.isArray(candidate.face_matches) ||
    (typeof candidate.status === "string" && typeof candidate.session_id === "string")) ?? null;
}

export function resolveDiditDecisionStatus(source: unknown): string {
  const record = asRecord(source);
  // Didit's overall decision includes every workflow check. Individual approved
  // ID/face nodes must never override an overall decline or review (e.g. AML).
  const status = normalizeStatus(record.status || record.verification_status || record.businessStatus ||
    asRecord(record.verification_data).status || asRecord(record.session).status || asRecord(record.result).status ||
    asRecord(record.decision).status);
  return ["PENDING", "PENDING_REVIEW", "APPROVED", "DECLINED", "ABANDONED", "EXPIRED", "SUPERSEDED"].includes(status) ? status : "";
}

function dateToken(value: unknown): string {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return "";
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : "";
}

export function extractIdentityDocument(source: unknown, fallback: Record<string, unknown> = {}) {
  const record = asRecord(source);
  const decision = findDecisionObject(source) ?? record;
  const ids = Array.isArray(decision.id_verifications) ? decision.id_verifications : [];
  const id = asRecord(ids[0] ?? record.id_verification ?? record.idVerification ?? source);
  const raw = asRecord(id.ocr_data ?? id.extracted_data ?? id.document ?? id.document_details ?? id);
  const first = (...values: unknown[]) => values.map(text).find(Boolean) ?? "";
  const fullName = first(raw.full_name, raw.fullName, raw.name,
    [raw.first_name, raw.middle_name, raw.last_name].map(text).filter(Boolean).join(" "), fallback.fullName);
  return {
    documentNumber: first(raw.document_number, raw.documentNumber, raw.id_number, raw.personal_number,
      raw.passport_number, raw.license_number, raw.national_id_number, asRecord(raw.extra_fields).document_number, fallback.documentNumber),
    documentType: first(id.document_type, raw.document_type, fallback.documentTypeKey, fallback.documentType).toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
    documentCountry: first(id.issuing_state, id.issuing_country, raw.issuing_country, fallback.documentCountry, "PHL").toUpperCase(),
    expiry: dateToken(first(id.expiration_date, raw.expiration_date, raw.expiry_date, raw.date_of_expiry, fallback.idDocumentExpiry)),
    fullName,
    normalizedFullName: fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim(),
    birthDate: dateToken(first(raw.date_of_birth, raw.birth_date, raw.dob, fallback.birthDate)),
  };
}

export interface SignupLocation { province: string; city: string; barangay: string; address: string }
export function validateSignupDetails(body: Record<string, unknown>): SignupLocation {
  if (typeof body.password === "string" && body.password !== body.password.trim())
    throw new Error("Remove spaces at the beginning or end of your password.");
  const location = { province: text(body.province), city: text(body.city), barangay: text(body.barangay), address: text(body.address) };
  if (Object.values(location).some((value) => !value || value.length > 500))
    throw new Error("Province, city or municipality, barangay, and specific address are required (up to 500 characters each).");
  if (body.acceptedIdentityTerms !== true || body.acceptedRaTerms !== true)
    throw new Error("Accept identity verification and the Terms and Conditions before registering.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(body.email))) throw new Error("Enter a valid email address.");
  if (!["client", "worker"].includes(text(body.appRole ?? body.app_role))) throw new Error("Choose a client or worker account.");
  return location;
}

export function buildProfilePayload(input: {
  user: { id: string; email?: string; email_confirmed_at?: string };
  email: string; fullName: string; appRole: string; identityRole: string; identityStatus: string;
  location: SignupLocation; diditSessionId?: string | null; idDocumentExpiry?: string | null;
}) {
  const approved = input.identityStatus === "APPROVED";
  return {
    user_id: input.user.id, email: input.email.toLowerCase(), full_name: input.fullName || input.email.split("@")[0],
    ...input.location, is_client: true, is_worker: input.appRole === "worker", role: input.appRole,
    identity_required: true, identity_role: input.identityRole,
    is_verified: approved && Boolean(input.user.email_confirmed_at), verification_status: input.identityStatus,
    didit_session_id: input.diditSessionId || null, id_document_expiry: input.idDocumentExpiry || null,
    id_verified_at: approved ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  };
}
