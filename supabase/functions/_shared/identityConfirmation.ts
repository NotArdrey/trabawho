import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import { asRecord } from "./identityDomain.ts";
import { sendEmailConfirmation } from "./confirmationEmail.ts";
import { ReviewError } from "./identityReviewError.ts";

export async function deliverIdentityConfirmation(client: SupabaseClient, reviewId: string, resend = false) {
  const result = await client.from("manual_identity_reviews").select("user_id,submitted_by_email,status,decision_email_sent_at,email_delivery_status").eq("id", reviewId).single();
  const review = asRecord(result.data);
  if (result.error || review.status !== "APPROVED") throw new ReviewError("Email confirmation is available after approval.", 409);
  const user = await client.auth.admin.getUserById(String(review.user_id));
  if (user.error) throw new ReviewError("The account could not be loaded. Retry email delivery.", 503);
  const profile = await client.from('profiles').select('verification_status,account_status,id_document_expiry').eq('user_id',review.user_id).single();
  const value = asRecord(profile.data);
  if (profile.error) throw new ReviewError('Identity approval could not be checked. Retry email delivery.',503);
  if (value.verification_status !== 'APPROVED' || value.account_status !== 'active' ||
    (typeof value.id_document_expiry === 'string' && value.id_document_expiry < new Date().toISOString().slice(0,10)))
    return { sent: false, required: false, status: 'not_required' };
  if (user.data.user.email_confirmed_at) return { sent: false, required: false, status: "not_required" };
  if (review.decision_email_sent_at && !resend) return { sent: true, required: true, status: "sent" };
  const lease = await client.rpc("claim_identity_email_delivery", { p_review_id: reviewId, p_resend: resend });
  if (lease.error) throw new ReviewError("Email delivery could not be started. Retry.", 503);
  if (lease.data !== true) return { sent: false, required: true, status: review.decision_email_sent_at ? "rate_limited" : "sending" };
  const appUrl = Deno.env.get("TRABAWHO_APP_URL") || "";
  const delivery = await sendEmailConfirmation(user.data.user.email || '', appUrl ? `${new URL(appUrl).origin}/register` : "");
  const saved = await client.from("manual_identity_reviews").update({
    email_delivery_status: delivery.sent ? "sent" : "failed",
    decision_email_sent_at: delivery.sent ? new Date().toISOString() : null,
    email_delivery_error: delivery.sent ? null : "Confirmation email could not be sent. Check Supabase Auth mail settings and retry.",
  }).eq("id", reviewId);
  if (saved.error) throw new ReviewError("Approval is saved. Refresh to check email delivery.", 503);
  return { sent: delivery.sent, required: true, status: delivery.sent ? "sent" : "failed" };
}
