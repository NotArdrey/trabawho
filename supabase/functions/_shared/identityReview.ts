import { createAdminClient } from "./identityRegistration.ts";
import { asRecord } from "./identityDomain.ts";
export type AdminClient = ReturnType<typeof createAdminClient>;
import { ReviewError } from "./identityReviewError.ts";
export { ReviewError } from "./identityReviewError.ts";
export { deliverIdentityConfirmation } from "./identityConfirmation.ts";
export const reviewColumns = "id,user_id,submitted_by_email,submitted_app_role,document_type,source,status,created_at,expected_decision_by,duplicate_reason,duplicate_match_count,reviewed_at,review_notes,decision_email_sent_at,email_delivery_status,email_delivery_error,verified_full_legal_name,didit_session_id";

export async function requireIdentityAdmin(req: Request, client: AdminClient): Promise<string> {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new ReviewError("Sign in as an administrator.", 401);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ReviewError("Your session has expired. Sign in again.", 401);
  const profile = await client.from("profiles").select("role,account_status").eq("user_id", data.user.id).single();
  const record = asRecord(profile.data);
  if (profile.error || record.role !== "admin" || record.account_status !== "active")
    throw new ReviewError("Only an active administrator can review identities.", 403);
  return data.user.id;
}

function imageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; }
  catch { return null; }
}
export function summarizeDiditReport(value: unknown) {
  const record = asRecord(value);
  const decision = Object.keys(asRecord(record.decision)).length ? asRecord(record.decision) : record;
  const records = (key: string) => Array.isArray(decision[key]) ? decision[key].map(asRecord) : [];
  const ids = records("id_verifications");
  const liveness = records("liveness_checks");
  const faces = records("face_matches");
  return {
    status: typeof decision.status === "string" ? decision.status : null,
    name: typeof ids[0]?.full_name === "string" ? ids[0].full_name : null,
    expiry: typeof ids[0]?.expiration_date === "string" ? ids[0].expiration_date : null,
    checks: ["id_verifications", "liveness_checks", "face_matches", "aml_screenings"].flatMap((key) =>
      records(key).map((item) => ({ label: key.replaceAll("_", " "), status: String(item.status || "Unknown") }))),
    warnings: [ids, liveness, faces, records("aml_screenings")].flat().flatMap((item) =>
      Array.isArray(item.warnings) ? item.warnings.map((warning: unknown) => {
        const entry = asRecord(warning);
        return String(entry.short_description || entry.risk || "A verification check needs review.");
      }) : []),
    images: ids.flatMap((item, index) => [
      { label: `ID ${index + 1} front`, url: imageUrl(item.front_image) },
      { label: `ID ${index + 1} back`, url: imageUrl(item.back_image) },
      { label: `ID ${index + 1} portrait`, url: imageUrl(item.portrait_image) },
    ]).concat(liveness.map((item, index) => ({ label: `Selfie ${index + 1}`, url: imageUrl(item.reference_image || item.face_image) })))
      .filter((item): item is { label: string; url: string } => item.url !== null),
  };
}

export async function loadIdentityReviewDetail(client: AdminClient, reviewId: string) {
  const { data, error } = await client.from("manual_identity_reviews").select("*").eq("id", reviewId).single();
  if (error || !data) throw new ReviewError("Identity review could not be loaded. Refresh the queue.", 404);
  const review = asRecord(data);
  const [profileResult, historyResult] = await Promise.all([
    client.from("profiles").select("full_name,email,role,province,city,barangay,address,verification_status,id_document_expiry,account_status,is_verified").eq("user_id", review.user_id).single(),
    client.from("identity_review_actions").select("id,decision,reason,created_at").eq("review_id", reviewId).order("created_at", { ascending: true }),
  ]);
  if (profileResult.error || historyResult.error) throw new ReviewError("Account details could not be loaded. Retry before deciding.", 503);
  const images: { label: string; url: string }[] = [];
  const warnings: string[] = [];
  for (const [key, label] of [["front_image_path", "ID front"], ["back_image_path", "ID back"], ["selfie_image_path", "Selfie"]]) {
    if (typeof review[key] !== "string") continue;
    const signed = await client.storage.from("identity-manual").createSignedUrl(review[key], 300);
    if (signed.error || !signed.data?.signedUrl) warnings.push(`${label} could not be loaded. Retry before approving.`);
    else images.push({ label, url: signed.data.signedUrl });
  }
  let didit = null;
  if (typeof review.didit_session_id === "string") {
    try {
      const apiKey = Deno.env.get("DIDIT_API_KEY") || "";
      const response = await fetch(`https://verification.didit.me/v3/session/${encodeURIComponent(review.didit_session_id)}/decision/`, {
        headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Didit report unavailable");
      didit = summarizeDiditReport(await response.json());
      images.push(...didit.images);
    } catch {
      warnings.push("The current Didit report could not be loaded. Review the session in the Didit console or retry.");
      const metadata = asRecord(review.metadata);
      const stored = asRecord(metadata.diditWebhook || metadata.diditVerificationData);
      didit = summarizeDiditReport(stored);
    }
  }
  const summary = Object.fromEntries(reviewColumns.split(",").map((key) => [key, review[key]]));
  const registration = await client.from('account_registrations')
    .select('source_legal_name,requested_legal_name,name_issue,reviewed_legal_name').eq('user_id', review.user_id).maybeSingle();
  if (registration.error) throw new ReviewError('Name review details could not be loaded. Retry.', 503);
  return { review: summary, profile: profileResult.data, history: historyResult.data, images, warnings, didit, registration: registration.data };
}
