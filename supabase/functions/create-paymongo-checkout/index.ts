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

interface CheckoutStart {
  bookingId: string;
  holdExpiresAt: string | null;
  paymentAttempt: PaymentAttempt;
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

const parseCheckoutStart = (value: unknown): CheckoutStart => {
  const result = asRecord(Array.isArray(value) ? value[0] : value);
  const booking = asRecord(result.booking);
  return {
    bookingId: cleanPaymentString(booking.id),
    holdExpiresAt: cleanPaymentString(result.holdExpiresAt) || null,
    paymentAttempt: parseAttempt(result.paymentAttempt),
  };
};

const getAppUrl = (request: Request) => {
  const parseOrigin = (candidate: string) => {
    if (!candidate) return null;
    try {
      const url = new URL(candidate);
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
      return { local, origin: url.origin };
    } catch {
      return null;
    }
  };

  const requestOrigin = parseOrigin(cleanPaymentString(request.headers.get("origin")));
  const configuredOrigin = parseOrigin(cleanPaymentString(Deno.env.get("TRABAWHO_APP_URL")));

  // Local development sessions belong to the exact browser origin (including
  // its port). Returning to the deployed URL would load a different Supabase
  // session and can make the user appear to have changed accounts.
  if (requestOrigin?.local) return requestOrigin.origin;
  if (configuredOrigin) return configuredOrigin.origin;
  if (requestOrigin) return requestOrigin.origin;

  throw new PaymentFunctionError("Payment return URL is not configured.", 500);
};

const parsePayMongoError = (payload: UnknownRecord) => {
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const first = asRecord(errors[0]);
  const detail = cleanPaymentString(first.detail);
  return detail || "PayMongo could not create the checkout session.";
};

const getBookingCheckoutError = (error: UnknownRecord) => {
  const code = cleanPaymentString(error.code);
  const message = cleanPaymentString(error.message);
  const expectedWorkflowCodes = new Set(["22023", "23505", "23514", "42501", "P0002"]);
  if (expectedWorkflowCodes.has(code) && message && !message.toLowerCase().includes("relation")) {
    return message.slice(0, 240);
  }
  return "This booking is not ready for payment.";
};

serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: paymentCorsHeaders });
  if (request.method !== "POST") return paymentJsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await parsePaymentJson(request);
    const bookingId = cleanPaymentString(body.bookingId) || null;
    const serviceId = Number(body.serviceId) || null;
    const slotId = Number(body.slotId) || null;
    const quoteVersion = Number(body.quoteVersion) || null;
    const paymentPlan = cleanPaymentString(body.paymentPlan) || "full";
    const idempotencyKey = cleanPaymentString(body.idempotencyKey);
    if ((!bookingId && (!serviceId || !slotId)) || !idempotencyKey) {
      throw new PaymentFunctionError("Choose a booking time before starting payment.");
    }

    const secretKey = cleanPaymentString(Deno.env.get("PAYMONGO_SECRET_KEY"));
    if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
      throw new PaymentFunctionError("PayMongo is not configured.", 503);
    }
    if (!secretKey.startsWith("sk_test_")) {
      throw new PaymentFunctionError("This demo only accepts PayMongo test payments.", 503);
    }
    const userClient = createPaymentUserClient(request);
    const { data: checkoutData, error: attemptError } = await userClient.rpc(
      "start_booking_checkout",
      {
        p_booking_id: bookingId,
        p_service_id: serviceId,
        p_slot_id: slotId,
        p_quote_version: quoteVersion,
        p_payment_plan: paymentPlan,
        p_operation_id: idempotencyKey,
      },
    );
    if (attemptError) {
      console.error("paymongo_attempt_create_failed", { code: attemptError.code, bookingId });
      throw new PaymentFunctionError(getBookingCheckoutError(asRecord(attemptError)), 409);
    }

    const checkoutStart = parseCheckoutStart(checkoutData);
    const attempt = checkoutStart.paymentAttempt;
    if (attempt.checkout_url && new Date(attempt.expires_at).getTime() > Date.now()) {
      return paymentJsonResponse({
        checkoutUrl: attempt.checkout_url,
        paymentAttemptId: attempt.id,
        bookingId: checkoutStart.bookingId,
        holdExpiresAt: checkoutStart.holdExpiresAt,
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
      payment_method_types: ["card"],
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

    return paymentJsonResponse({
      checkoutUrl,
      paymentAttemptId: attempt.id,
      bookingId: checkoutStart.bookingId,
      holdExpiresAt: checkoutStart.holdExpiresAt,
    });
  } catch (error) {
    const safeError = safePaymentError(error);
    if (safeError.status >= 500) console.error("paymongo_checkout_failed", error);
    return paymentJsonResponse({ error: safeError.message }, safeError.status);
  }
});
