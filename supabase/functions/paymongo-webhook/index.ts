import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  asRecord,
  cleanPaymentString,
  createPaymentAdminClient,
  paymentJsonResponse,
  sha256PaymentHex,
  verifyPayMongoSignature,
} from "../_shared/paymongo.ts";

interface PaidCheckoutEvent {
  amount: number;
  checkoutSessionId: string;
  currency: string;
  eventId: string;
  eventType: string;
  livemode: boolean;
  paymentId: string;
}

const firstRecord = (value: unknown) => asRecord(Array.isArray(value) ? value[0] : value);

const parsePaidCheckoutEvent = async (payload: unknown, rawBody: string): Promise<PaidCheckoutEvent> => {
  const root = asRecord(payload);
  const envelope = asRecord(root.data);
  const legacyAttributes = asRecord(envelope.attributes);
  const eventType = cleanPaymentString(envelope.type || legacyAttributes.type);
  const session = asRecord(envelope.data || legacyAttributes.data);
  const sessionAttributes = asRecord(session.attributes);
  const payment = firstRecord(sessionAttributes.payments);
  const paymentAttributes = asRecord(payment.attributes);
  const amountCentavos = Number(paymentAttributes.amount);
  const eventId = cleanPaymentString(envelope.id) || `body-${await sha256PaymentHex(rawBody)}`;

  if (eventType !== "checkout_session.payment.paid") {
    throw new Error("Unsupported PayMongo event type.");
  }
  if (!session.id || !payment.id || !Number.isInteger(amountCentavos) || amountCentavos <= 0) {
    throw new Error("Incomplete PayMongo checkout payment event.");
  }
  if (cleanPaymentString(paymentAttributes.status).toLowerCase() !== "paid") {
    throw new Error("PayMongo payment is not paid.");
  }

  return {
    amount: amountCentavos / 100,
    checkoutSessionId: cleanPaymentString(session.id),
    currency: cleanPaymentString(paymentAttributes.currency).toUpperCase(),
    eventId,
    eventType,
    livemode: Boolean(envelope.livemode ?? legacyAttributes.livemode),
    paymentId: cleanPaymentString(payment.id),
  };
};

serve(async (request: Request) => {
  if (request.method !== "POST") return paymentJsonResponse({ error: "Method not allowed" }, 405);

  const rawBody = await request.text();
  const webhookSecret = cleanPaymentString(Deno.env.get("PAYMONGO_WEBHOOK_SECRET"));
  const signatureHeader = cleanPaymentString(request.headers.get("paymongo-signature"));
  if (!webhookSecret || !signatureHeader || !(await verifyPayMongoSignature({
    rawBody,
    signatureHeader,
    webhookSecret,
  }))) {
    return paymentJsonResponse({ error: "Invalid PayMongo webhook signature" }, 401);
  }

  try {
    const payload: unknown = JSON.parse(rawBody);
    const event = await parsePaidCheckoutEvent(payload, rawBody);
    const payloadHash = await sha256PaymentHex(rawBody);
    const admin = createPaymentAdminClient();
    const { error } = await admin.rpc("record_paymongo_checkout_payment", {
      p_event_id: event.eventId,
      p_event_type: event.eventType,
      p_checkout_session_id: event.checkoutSessionId,
      p_payment_id: event.paymentId,
      p_amount: event.amount,
      p_currency: event.currency,
      p_livemode: event.livemode,
      p_payload_hash: payloadHash,
    });
    if (error) {
      console.error("paymongo_webhook_record_failed", {
        code: error.code,
        eventId: event.eventId,
        checkoutSessionId: event.checkoutSessionId,
      });
      return paymentJsonResponse({ error: "Payment event could not be recorded." }, 500);
    }

    return paymentJsonResponse({ received: true });
  } catch (error) {
    console.error("paymongo_webhook_failed", error);
    return paymentJsonResponse({ error: "Invalid PayMongo webhook payload." }, 400);
  }
});
