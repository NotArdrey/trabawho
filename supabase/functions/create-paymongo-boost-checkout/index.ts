import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { asRecord, cleanPaymentString, createPaymentAdminClient, createPaymentUserClient, paymentCorsHeaders,
  PaymentFunctionError, paymentJsonResponse, parsePaymentJson, safePaymentError } from "../_shared/paymongo.ts";
import { boostSecret, boostAppOrigin, boostCheckoutRecord, validBoostCheckoutUrl } from "../_shared/gigBoost.ts";

serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: paymentCorsHeaders });
  if (request.method !== "POST") return paymentJsonResponse({ error: "Method not allowed" }, 405);
  try {
    const secret = boostSecret();
    const body = await parsePaymentJson(request);
    const serviceId = Number(body.serviceId);
    const days = Number(body.days);
    const amount = Number(body.amount);
    const operation = cleanPaymentString(body.operationId);
    if (!Number.isSafeInteger(serviceId) || !Number.isInteger(days) || !Number.isFinite(amount) || !operation) {
      throw new PaymentFunctionError("Choose a gig and valid boost settings.");
    }
    const user = createPaymentUserClient(request);
    const { data, error } = await user.rpc("start_service_ad_boost_checkout", {
      p_service_id: serviceId, p_duration_days: days, p_amount: amount, p_operation_id: operation,
    });
    if (error) {
      const safeCodes = ["22023", "23514", "42501"];
      throw new PaymentFunctionError(safeCodes.includes(error.code) ? String(error.message).slice(0, 240) : "Unable to start this gig boost checkout.", 409);
    }
    const attempt = boostCheckoutRecord(data);
    const response = (url: string) => paymentJsonResponse({ checkoutUrl: url, attemptId: attempt.id, expiresAt: attempt.expires_at });
    if (attempt.checkout_url) return response(validBoostCheckoutUrl(attempt.checkout_url));
    const app = boostAppOrigin(request);
    const query = `boostAttempt=${encodeURIComponent(attempt.id)}`;
    const providerResponse = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${secret}:`)}`, "Content-Type": "application/json", "Idempotency-Key": `boost:${attempt.id}` },
      body: JSON.stringify({ data: { attributes: {
        line_items: [{ name: `Gig boost: ${cleanPaymentString(attempt.service_title)}`.slice(0, 120),
          description: `${attempt.duration_days} days of marketplace recommendation priority`, amount: Math.round(attempt.amount * 100), currency: "PHP", quantity: 1 }],
        payment_method_types: ["card"], reference_number: attempt.reference_number, send_email_receipt: true,
        success_url: `${app}/profile?boostPayment=verifying&${query}`,
        cancel_url: `${app}/profile?boostPayment=cancelled&${query}`,
        metadata: { boost_attempt_id: attempt.id, service_id: String(attempt.service_id) },
      } } }),
    });
    const payload = asRecord(await providerResponse.json().catch(() => ({})));
    const admin = createPaymentAdminClient();
    if (!providerResponse.ok) {
      await admin.from("service_ad_boost_attempts").update({ status: providerResponse.status >= 500 ? "created" : "failed",
        failure_message: "PayMongo could not create checkout.", updated_at: new Date().toISOString() }).eq("id", attempt.id);
      console.error("boost_checkout_provider_error", { status: providerResponse.status, attemptId: attempt.id });
      throw new PaymentFunctionError("PayMongo could not open checkout. Please retry.", 502);
    }
    const session = asRecord(payload.data);
    const attributes = asRecord(session.attributes);
    if (!session.id || attributes.livemode !== false) throw new PaymentFunctionError("PayMongo returned an unexpected payment environment.", 502);
    const url = validBoostCheckoutUrl(attributes.checkout_url);
    const { error: attachError } = await admin.from("service_ad_boost_attempts").update({
      checkout_session_id: session.id, checkout_url: url, status: "awaiting_payment", updated_at: new Date().toISOString(),
    }).eq("id", attempt.id).in("status", ["created", "awaiting_payment"]);
    if (attachError) throw new PaymentFunctionError("Unable to attach payment to this boost. Please retry.", 500);
    return response(url);
  } catch (error) {
    const safe = safePaymentError(error);
    if (safe.status >= 500) console.error("boost_checkout_failed", error instanceof Error ? error.message : "unknown");
    return paymentJsonResponse({ error: safe.message }, safe.status);
  }
});
