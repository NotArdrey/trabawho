import { asRecord, cleanPaymentString, PaymentFunctionError } from "./paymongo.ts";

export const boostSecret = () => {
  const secret = cleanPaymentString(Deno.env.get("PAYMONGO_SECRET_KEY"));
  if (!secret.startsWith("sk_test_")) throw new PaymentFunctionError("PayMongo test checkout is not configured.", 503);
  return secret;
};

export const boostAppOrigin = (request: Request) => {
  const parse = (value: string) => {
    try {
      const url = new URL(value);
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      return url.protocol === "https:" || (local && url.protocol === "http:") ? { origin: url.origin, local } : null;
    } catch { return null; }
  };
  const requested = parse(request.headers.get("origin") || "");
  const configured = parse(Deno.env.get("TRABAWHO_APP_URL") || "");
  const origin = requested?.local ? requested.origin : configured?.origin || requested?.origin;
  if (!origin) throw new PaymentFunctionError("Payment return URL is not configured.", 503);
  return origin;
};

export const boostCheckoutRecord = (value: unknown) => {
  const attempt = asRecord(value);
  const amount = Number(attempt.amount);
  if (!attempt.id || !attempt.service_id || !Number.isFinite(amount) || amount < 1 || attempt.environment !== "test") {
    throw new PaymentFunctionError("Boost checkout details are unavailable.", 409);
  }
  return { ...attempt, id: cleanPaymentString(attempt.id), amount,
    checkout_session_id: cleanPaymentString(attempt.checkout_session_id), checkout_url: cleanPaymentString(attempt.checkout_url) };
};

export const validBoostCheckoutUrl = (value: unknown) => {
  try {
    const url = new URL(cleanPaymentString(value));
    if (url.protocol === "https:" && url.hostname === "checkout.paymongo.com") return url.toString();
  } catch { /* Reject untrusted redirect targets. */ }
  throw new PaymentFunctionError("The payment provider returned an invalid checkout link.", 502);
};
