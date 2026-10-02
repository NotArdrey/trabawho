import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { asRecord, cleanPaymentString, createPaymentAdminClient, createPaymentUserClient, paymentCorsHeaders,
  PaymentFunctionError, paymentJsonResponse, parsePaymentJson, safePaymentError, sha256PaymentHex } from "../_shared/paymongo.ts";
import { boostSecret, boostCheckoutRecord } from "../_shared/gigBoost.ts";

serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: paymentCorsHeaders });
  if (request.method !== "POST") return paymentJsonResponse({ error: "Method not allowed" }, 405);
  try {
    const body = await parsePaymentJson(request);
    const attemptId = cleanPaymentString(body.attemptId);
    if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw new PaymentFunctionError("Choose a valid boost payment.");
    const user = createPaymentUserClient(request);
    const { data, error } = await user.from("service_ad_boost_attempts").select("*").eq("id", attemptId).maybeSingle();
    if (error || !data) throw new PaymentFunctionError("This boost payment is unavailable for your account.", 404);
    const attempt = boostCheckoutRecord(data);
    const result = (record: Record<string, unknown>) => paymentJsonResponse({
      status: record.status, verified: record.status === "paid", requiresReview: record.status === "paid_needs_review",
      serviceId: record.service_id, endsAt: record.ends_at || null,
    });
    if (["paid", "paid_needs_review"].includes(cleanPaymentString(attempt.status)) || !attempt.checkout_session_id) return result(attempt);
    const provider = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(attempt.checkout_session_id)}`, {
      headers: { Authorization: `Basic ${btoa(`${boostSecret()}:`)}` },
    });
    if (!provider.ok) throw new PaymentFunctionError("Payment verification is temporarily unavailable. Please retry.", 502);
    const raw = await provider.text();
    const session = asRecord(asRecord(JSON.parse(raw)).data);
    const attributes = asRecord(session.attributes);
    if (session.id !== attempt.checkout_session_id || attributes.livemode !== false
      || asRecord(attributes.metadata).boost_attempt_id !== attempt.id) {
      throw new PaymentFunctionError("Payment verification did not match this boost.", 409);
    }
    const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
    const payment = payments.map(asRecord).find((item) => asRecord(item.attributes).status === "paid");
    if (!payment) return result(attempt);
    const details = asRecord(payment.attributes);
    if (details.amount !== Math.round(attempt.amount * 100) || details.currency !== "PHP" || !payment.id) {
      throw new PaymentFunctionError("The paid amount did not match this boost. Contact support.", 409);
    }
    const admin = createPaymentAdminClient();
    const { data: paid, error: recordError } = await admin.rpc("record_paymongo_boost_payment", {
      p_event_id: `boost-reconcile:${attempt.id}:${payment.id}`, p_event_type: "checkout_session.api_reconciled",
      p_checkout_session_id: session.id, p_payment_id: payment.id, p_amount: Number(details.amount) / 100,
      p_currency: details.currency, p_livemode: attributes.livemode, p_payload_hash: await sha256PaymentHex(raw),
    });
    if (recordError) throw new PaymentFunctionError("Payment was received but boost activation needs support review.", 409);
    return result(asRecord(paid));
  } catch (error) {
    const safe = safePaymentError(error);
    return paymentJsonResponse({ error: safe.message }, safe.status);
  }
});
