import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  asRecord,
  cleanPaymentString,
  createPaymentAdminClient,
  createPaymentUserClient,
  paymentCorsHeaders,
  PaymentFunctionError,
  paymentJsonResponse,
  parsePaymentJson,
  safePaymentError,
  type UnknownRecord,
} from "../_shared/paymongo.ts";

const PAYMONGO_CHECKOUT_URL = "https://api.paymongo.com/v2/checkout_sessions";

interface PaymentAttempt {
  id: string;
  amount: number;
  booking_id: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  currency: string;
  environment: "test" | "live";
  expires_at: string;
  idempotency_key: string;
  reference_number: string;
  status: string;
}

const parseAttempt = (value: unknown): PaymentAttempt => {
  const record = asRecord(Array.isArray(value) ? value[0] : value);
  const amount = Number(record.amount);
  const environment = cleanPaymentString(record.environment);
  if (!record.id || !record.booking_id || !Number.isFinite(amount)) {
    throw new PaymentFunctionError("Payment attempt could not be created.", 500);
  }
  if (environment !== "test" && environment !== "live") {
    throw new PaymentFunctionError("Payment environment is invalid.", 500);
  }
  return {
    id: cleanPaymentString(record.id),
    amount,
    booking_id: cleanPaymentString(record.booking_id),
    checkout_session_id: cleanPaymentString(record.checkout_session_id) || null,
    checkout_url: cleanPaymentString(record.checkout_url) || null,
    currency: cleanPaymentString(record.currency) || "PHP",
    environment,
    expires_at: cleanPaymentString(record.expires_at),
    idempotency_key: cleanPaymentString(record.idempotency_key),
    reference_number: cleanPaymentString(record.reference_number),
    status: cleanPaymentString(record.status),
  };
};

const getAppUrl = (request: Request) => {
  const configured = cleanPaymentString(Deno.env.get("TRABAWHO_APP_URL"));
  const candidate = configured || cleanPaymentString(request.headers.get("origin"));
  try {
    const url = new URL(candidate);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error();
    return url.origin;
  } catch {
    throw new PaymentFunctionError("Payment return URL is not configured.", 500);
  }
};

const parsePayMongoError = (payload: UnknownRecord) => {
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const first = asRecord(errors[0]);
  const detail = cleanPaymentString(first.detail);
  return detail || "PayMongo could not create the checkout session.";
};

serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: paymentCorsHeaders });
  if (request.method !== "POST") return paymentJsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await parsePaymentJson(request);
    const bookingId = cleanPaymentString(body.bookingId);
    const idempotencyKey = cleanPaymentString(body.idempotencyKey);
    if (!bookingId || !idempotencyKey) {
      throw new PaymentFunctionError("Booking and payment request identifiers are required.");
    }

    const secretKey = cleanPaymentString(Deno.env.get("PAYMONGO_SECRET_KEY"));
    if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
      throw new PaymentFunctionError("PayMongo is not configured.", 503);
    }
    const environment = secretKey.startsWith("sk_live_") ? "live" : "test";
    const userClient = createPaymentUserClient(request);
    const { data: attemptData, error: attemptError } = await userClient.rpc(
      "create_booking_payment_attempt",
      {
        p_booking_id: bookingId,
        p_idempotency_key: idempotencyKey,
        p_environment: environment,
      },
    );
    if (attemptError) {
      console.error("paymongo_attempt_create_failed", { code: attemptError.code, bookingId });
      throw new PaymentFunctionError("This booking is not ready for payment.", 409);
    }

    const attempt = parseAttempt(attemptData);
    if (attempt.checkout_url && new Date(attempt.expires_at).getTime() > Date.now()) {
      return paymentJsonResponse({
        checkoutUrl: attempt.checkout_url,
        paymentAttemptId: attempt.id,
      });
    }

    const admin = createPaymentAdminClient();
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, service_id, metadata, services(title)")
      .eq("id", attempt.booking_id)
      .single();
    if (bookingError || !booking) {
      throw new PaymentFunctionError("Booking details are unavailable.", 409);
    }

    const bookingRecord = asRecord(booking);
    const service = asRecord(bookingRecord.services);
    const metadata = asRecord(bookingRecord.metadata);
    const serviceName = cleanPaymentString(service.title || metadata.service_type) || "TrabaWho service";
    const appUrl = getAppUrl(request);
    const returnQuery = `booking=${encodeURIComponent(attempt.booking_id)}&attempt=${encodeURIComponent(attempt.id)}`;
    const attributes = {
      line_items: [{
        name: serviceName.slice(0, 120),
        amount: Math.round(attempt.amount * 100),
        currency: attempt.currency,
        quantity: 1,
      }],
      payment_method_types: ["gcash"],
      success_url: `${appUrl}/bookings?payment=verifying&${returnQuery}`,
      cancel_url: `${appUrl}/bookings?payment=cancelled&${returnQuery}`,
      reference_number: attempt.reference_number,
      send_email_receipt: true,
      metadata: {
        booking_id: attempt.booking_id,
        payment_attempt_id: attempt.id,
      },
    };

    const payMongoResponse = await fetch(PAYMONGO_CHECKOUT_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${secretKey}:`)}`,
        "Content-Type": "application/json",
        "Idempotency-Key": attempt.idempotency_key,
      },
      body: JSON.stringify({ data: { attributes } }),
    });
    const payMongoPayload = asRecord(await payMongoResponse.json().catch(() => ({})));
    if (!payMongoResponse.ok) {
      const message = parsePayMongoError(payMongoPayload);
      await admin.from("payment_attempts").update({
        status: payMongoResponse.status >= 500 ? "created" : "failed",
        failure_code: String(payMongoResponse.status),
        failure_message: message.slice(0, 500),
      }).eq("id", attempt.id);
      console.error("paymongo_checkout_create_failed", { status: payMongoResponse.status, attemptId: attempt.id });
      throw new PaymentFunctionError(message, payMongoResponse.status >= 500 ? 502 : 400);
    }

    const responseData = asRecord(payMongoPayload.data);
    const responseAttributes = asRecord(responseData.attributes);
    const checkoutSessionId = cleanPaymentString(responseData.id);
    const checkoutUrl = cleanPaymentString(responseAttributes.checkout_url);
    if (!checkoutSessionId || !checkoutUrl.startsWith("https://")) {
      throw new PaymentFunctionError("PayMongo returned an invalid checkout session.", 502);
    }

    const { error: updateError } = await admin.from("payment_attempts").update({
      checkout_session_id: checkoutSessionId,
      checkout_url: checkoutUrl,
      status: "awaiting_payment",
      failure_code: null,
      failure_message: null,
    }).eq("id", attempt.id);
    if (updateError) {
      console.error("paymongo_attempt_attach_failed", { code: updateError.code, attemptId: attempt.id });
      throw new PaymentFunctionError("Checkout was created but could not be attached to the booking.", 500);
    }

    return paymentJsonResponse({ checkoutUrl, paymentAttemptId: attempt.id });
  } catch (error) {
    const safeError = safePaymentError(error);
    if (safeError.status >= 500) console.error("paymongo_checkout_failed", error);
    return paymentJsonResponse({ error: safeError.message }, safeError.status);
  }
});
