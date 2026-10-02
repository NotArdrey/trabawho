import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { asRecord, cleanPaymentString, createPaymentAdminClient, createPaymentUserClient, paymentCorsHeaders, paymentJsonResponse, safePaymentError, sha256PaymentHex } from "../_shared/paymongo.ts";

serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: paymentCorsHeaders });
  if (request.method !== "POST") return paymentJsonResponse({ error: "Method not allowed" }, 405);
  try {
    const body = asRecord(await request.json());
    const attemptId = cleanPaymentString(body.attemptId);
    if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return paymentJsonResponse({ error: "A valid payment attempt is required." }, 400);

    const userClient = createPaymentUserClient(request);
    const { data: identity, error: identityError } = await userClient.auth.getUser();
    if (identityError || !identity.user) return paymentJsonResponse({ error: "Sign in to check payment." }, 401);
    const admin = createPaymentAdminClient();
    const { data: attempt, error: attemptError } = await admin.from("payment_attempts")
      .select("id, booking_id, buyer_id, checkout_session_id, amount, currency, environment, status")
      .eq("id", attemptId).single();
    if (attemptError || !attempt || attempt.buyer_id !== identity.user.id) {
      return paymentJsonResponse({ error: "Payment attempt not found." }, 404);
    }
    if (attempt.status === "paid" || attempt.status === "late_paid") {
      return paymentJsonResponse({ verified: attempt.status === "paid", latePaid: attempt.status === "late_paid", bookingId: attempt.booking_id });
    }
    if (!attempt.checkout_session_id || attempt.environment !== "test") {
      return paymentJsonResponse({ error: "This test checkout cannot be reconciled." }, 409);
    }
    const secret = cleanPaymentString(Deno.env.get("PAYMONGO_SECRET_KEY"));
    if (!secret.startsWith("sk_test_")) return paymentJsonResponse({ error: "Test payment verification is unavailable." }, 503);
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(attempt.checkout_session_id)}`, {
      headers: { Authorization: `Basic ${btoa(`${secret}:`)}`, Accept: "application/json" },
    });
    if (!response.ok) return paymentJsonResponse({ error: "PayMongo could not verify this checkout yet." }, 503);
    const responseText = await response.text();
    const session = asRecord(asRecord(JSON.parse(responseText)).data);
    const attributes = asRecord(session.attributes);
    if (cleanPaymentString(session.id) !== attempt.checkout_session_id || attributes.livemode === true) {
      return paymentJsonResponse({ error: "Checkout identity or environment mismatch." }, 409);
    }
    const metadata = asRecord(attributes.metadata);
    if (cleanPaymentString(metadata.payment_attempt_id) !== attempt.id || cleanPaymentString(metadata.booking_id) !== attempt.booking_id) {
      return paymentJsonResponse({ error: "Checkout reference does not match this booking." }, 409);
    }
    const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
    const paid = payments.map(asRecord).find((item) => {
      const detail = asRecord(item.attributes);
      return cleanPaymentString(detail.status) === "paid"
        && Number(detail.amount) === Math.round(Number(attempt.amount) * 100)
        && cleanPaymentString(detail.currency).toUpperCase() === attempt.currency;
    });
    if (!paid) return paymentJsonResponse({ verified: false, bookingId: attempt.booking_id });

    const paymentId = cleanPaymentString(paid.id);
    if (!paymentId) return paymentJsonResponse({ error: "PayMongo did not provide a payment ID." }, 409);
    const { error: recordError } = await admin.rpc("record_paymongo_checkout_payment", {
      p_event_id: `api-reconcile:${paymentId}`,
      p_event_type: "checkout_session.payment.paid.api_reconciled",
      p_checkout_session_id: attempt.checkout_session_id,
      p_payment_id: paymentId,
      p_amount: Number(attempt.amount),
      p_currency: attempt.currency,
      p_livemode: false,
      p_payload_hash: await sha256PaymentHex(responseText),
    });
    if (recordError) {
      console.error("paymongo_reconciliation_record_failed", { code: recordError.code, attemptId });
      return paymentJsonResponse({ error: "PayMongo verified the payment, but the booking needs support review." }, 409);
    }
    const [{ data: verifiedBooking }, { data: recordedAttempt }] = await Promise.all([
      admin.from("bookings").select("payment_status").eq("id", attempt.booking_id).single(),
      admin.from("payment_attempts").select("status").eq("id", attempt.id).single(),
    ]);
    const latePaid = recordedAttempt?.status === "late_paid";
    return paymentJsonResponse({ verified: !latePaid && recordedAttempt?.status === "paid" && ["paid", "partially_paid"].includes(cleanPaymentString(verifiedBooking?.payment_status)), latePaid, bookingId: attempt.booking_id });
  } catch (error) {
    console.error("paymongo_reconciliation_failed", error);
    const safe = safePaymentError(error);
    return paymentJsonResponse({ error: safe.message }, safe.status);
  }
});
