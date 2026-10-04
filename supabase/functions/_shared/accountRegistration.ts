import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import { asRecord, extractIdentityDocument, resolveDiditDecisionStatus } from "./identityDomain.ts";
import { buildIdentityDocumentFingerprint, sanitizeIdentityVerificationData } from "./identityRegistration.ts";

export const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
export function accountClient() {
  return createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false, autoRefreshToken: false } });
}
export class AccountError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function signupRole(value: unknown): 'client' | 'worker' {
  // Older frontend bundles omit the account type and continue to create Clients.
  if (value === undefined || value === 'client') return 'client';
  if (value === 'worker') return 'worker';
  throw new AccountError('Choose Client or Worker to continue.');
}
export async function accountUser(request: Request, client: ReturnType<typeof accountClient>): Promise<User> {
  const token = text(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new AccountError("Sign in to continue your registration.", 401);
  const profile = await client.from("profiles").select("account_status").eq("user_id", data.user.id).single();
  if (profile.error || asRecord(profile.data).account_status !== "active")
    throw new AccountError("Account access is restricted. Contact support.", 403);
  return data.user;
}
export async function registrationRow(client: ReturnType<typeof accountClient>, userId: string) {
  const result = await client.from("account_registrations").select("*").eq("user_id", userId).maybeSingle();
  if (result.error) throw new AccountError("Registration could not be loaded. Retry.", 503);
  return result.data ? asRecord(result.data) : null;
}
export function requireConfirmed(user: User) {
  if (!user.email_confirmed_at) throw new AccountError("Confirm your email before identity verification.", 403);
}
export async function registrationState(client: ReturnType<typeof accountClient>, user: User) {
  const row = await registrationRow(client, user.id);
  if (!row) return { state: "legacy", email: user.email };
  const profile = await client.from("profiles").select("verification_status,is_verified,id_document_expiry").eq("user_id", user.id).single();
  if (profile.error) throw new AccountError("Identity access could not be checked. Retry.", 503);
  const value = asRecord(profile.data);
  const status = text(value.verification_status);
  const expired = text(value.id_document_expiry) && text(value.id_document_expiry) < new Date().toISOString().slice(0, 10);
  const state = !user.email_confirmed_at ? "email_pending"
    : expired || ["DECLINED", "ABANDONED", "EXPIRED"].includes(status) ? "declined"
    : status === "APPROVED" && value.is_verified === true && (row.name_confirmed_at || row.reviewed_legal_name) ? "ready"
    : status === "PENDING_REVIEW" ? "identity_review"
    : row.provider_status === "APPROVED" && row.source_legal_name && !row.name_issue ? "name_pending"
    : row.current_session_id ? "identity_in_progress" : "identity_pending";
  let sessionUrl: string | null = null;
  if (row.current_session_id) {
    const session = await client.from("verification_sessions").select("verification_data").eq("session_ref", row.current_session_id).eq("user_id", user.id).maybeSingle();
    if (session.error) throw new AccountError("Verification session could not be loaded. Retry.", 503);
    sessionUrl = text(asRecord(asRecord(session.data).verification_data).session_url) || null;
  }
  return { state, email: user.email, signupRole: row.account_role === 'worker' ? 'worker' : 'client', legalName: row.source_legal_name, documentType: row.document_type,
    requestedName: row.requested_legal_name, nameIssue: row.name_issue, sessionId: row.current_session_id,
    sessionUrl, providerStatus: row.provider_status, providerSetupComplete: Boolean(row.provider_setup_completed_at) };
}
export function verifiedDocument(payload: unknown) {
  const document = extractIdentityDocument(payload);
  const record = asRecord(payload);
  const decision = asRecord(record.decision ?? payload);
  const ids = Array.isArray(decision.id_verifications) ? decision.id_verifications : [];
  const names = ids.map((id) => extractIdentityDocument({ id_verifications: [id] }).normalizedFullName).filter(Boolean);
  const id = asRecord(ids[0]);
  const raw = asRecord(id.ocr_data ?? id.extracted_data ?? id.document ?? id.document_details ?? id);
  const explicitName = text(raw.full_name ?? raw.fullName ?? raw.name);
  const partialName = !explicitName && Boolean(text(raw.first_name) || text(raw.last_name)) &&
    (!text(raw.first_name) || !text(raw.last_name));
  return { ...document, nameAmbiguous: new Set(names).size > 1 || partialName || !/\p{L}/u.test(document.fullName) };
}
export async function pollAccountIdentity(client: ReturnType<typeof accountClient>, user: User) {
  requireConfirmed(user);
  const row = await registrationRow(client, user.id);
  const sessionId = text(row?.current_session_id);
  if (!sessionId) return registrationState(client, user);
  const response = await fetch(`https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`, {
    headers: { "x-api-key": Deno.env.get("DIDIT_API_KEY") || "" }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new AccountError("Didit could not check your result. Retry shortly.", 503);
  const payload: unknown = await response.json();
  const status = resolveDiditDecisionStatus(payload);
  if (!status) throw new AccountError("The verification result is not available yet. Retry shortly.", 503);
  const document = verifiedDocument(payload);
  const fingerprint: string | null = await buildIdentityDocumentFingerprint(payload);
  const saved = await client.rpc("apply_didit_identity_event", {
    p_event_key: `poll:${crypto.randomUUID()}`, p_payload_hash: "server-poll", p_session_id: sessionId,
    p_status: status, p_payload: { ...asRecord(sanitizeIdentityVerificationData(payload)), created_at: Math.floor(Date.now() / 1000), timestamp: Math.floor(Date.now() / 1000) },
    p_document: { ...document, documentNumber: undefined }, p_fingerprint: fingerprint,
  });
  if (saved.error) throw new AccountError("The result could not be saved. Retry.", 503);
  return registrationState(client, user);
}
