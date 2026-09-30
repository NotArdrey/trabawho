import { supabase } from "@/integrations/supabase";

interface CheckoutBooking {
  amountPaid?: number | string;
  id: string;
  paymentPlan?: string;
  paymentStatus?: string;
}

interface CheckoutFunctionResponse {
  checkoutUrl?: unknown;
  error?: unknown;
  paymentAttemptId?: unknown;
}

export interface PayMongoCheckout {
  checkoutUrl: string;
  paymentAttemptId: string;
}

const getPaymentPurpose = (booking: CheckoutBooking) =>
  booking.paymentStatus === "partially_paid" || Number(booking.amountPaid || 0) > 0
    ? "balance"
    : "initial";

const getIdempotencyStorageKey = (booking: CheckoutBooking) =>
  `trabawho:paymongo:${booking.id}:${getPaymentPurpose(booking)}:${booking.paymentPlan || "full"}`;

const createOperationId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `checkout:${crypto.randomUUID()}`;
  }
  return `checkout:${Date.now()}:${Math.random().toString(36).slice(2, 14)}`;
};

const getStableIdempotencyKey = (booking: CheckoutBooking) => {
  const storageKey = getIdempotencyStorageKey(booking);
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = createOperationId();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return createOperationId();
  }
};

const validateCheckoutUrl = (value: unknown) => {
  try {
    if (typeof value !== "string") throw new Error();
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "checkout.paymongo.com") throw new Error();
    return url.toString();
  } catch {
    throw new Error("The payment provider returned an invalid checkout link.");
  }
};

export async function createPayMongoCheckout(booking: CheckoutBooking): Promise<PayMongoCheckout> {
  if (!booking?.id) throw new Error("Select a booking before starting payment.");

  const rawResponse: unknown = await supabase.functions.invoke<CheckoutFunctionResponse>(
    "create-paymongo-checkout",
    {
      body: {
        bookingId: booking.id,
        idempotencyKey: getStableIdempotencyKey(booking),
      },
    },
  );
  const response = rawResponse !== null && typeof rawResponse === "object"
    ? rawResponse as { data?: unknown; error?: unknown }
    : {};
  const data = response.data !== null && typeof response.data === "object"
    ? response.data as CheckoutFunctionResponse
    : undefined;

  if (response.error) throw new Error("Unable to open secure GCash checkout. Please try again.");
  if (typeof data?.error === "string" && data.error) throw new Error(data.error);

  const paymentAttemptId = typeof data?.paymentAttemptId === "string"
    ? data.paymentAttemptId.trim()
    : "";
  if (!paymentAttemptId) throw new Error("The payment attempt could not be created.");

  return {
    checkoutUrl: validateCheckoutUrl(data?.checkoutUrl),
    paymentAttemptId,
  };
}

export function redirectToPayMongo(checkout: PayMongoCheckout) {
  window.location.assign(checkout.checkoutUrl);
}
