import { supabase } from "@/integrations/supabase";

interface CheckoutBooking {
  amountPaid?: number | string;
  id?: string;
  quoteVersion?: number | string;
  serviceId?: number | string;
  selectedSlot?: {
    slotId?: number | string | null;
    rawSlot?: { id?: number | string | null } | null;
    timeBlock?: { rawSlot?: { id?: number | string | null } | null } | null;
  } | null;
  paymentPlan?: string;
  paymentStatus?: string;
}

interface CheckoutFunctionResponse {
  checkoutUrl?: unknown;
  bookingId?: unknown;
  error?: unknown;
  holdExpiresAt?: unknown;
  paymentAttemptId?: unknown;
}

export interface PayMongoCheckout {
  bookingId: string;
  checkoutUrl: string;
  holdExpiresAt: string | null;
  paymentAttemptId: string;
}

const getSlotId = (booking: CheckoutBooking) =>
  booking.selectedSlot?.timeBlock?.rawSlot?.id
  ?? booking.selectedSlot?.rawSlot?.id
  ?? booking.selectedSlot?.slotId
  ?? null;

const getPaymentPurpose = (booking: CheckoutBooking) =>
  booking.paymentStatus === "partially_paid" || Number(booking.amountPaid || 0) > 0
    ? "balance"
    : "initial";

const getIdempotencyStorageKey = (booking: CheckoutBooking) =>
  `trabawho:paymongo:${booking.id || booking.serviceId}:${getSlotId(booking)}:${booking.quoteVersion || "listed"}:${getPaymentPurpose(booking)}:${booking.paymentPlan || "downpayment"}`;

const operationCache = new Map<string, { key: string; expiresAt: number }>();

const createOperationId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `checkout:${crypto.randomUUID()}`;
  }
  return `checkout:${Date.now()}:${Math.random().toString(36).slice(2, 14)}`;
};

const getStableIdempotencyKey = (booking: CheckoutBooking) => {
  const storageKey = getIdempotencyStorageKey(booking);
  let operation = operationCache.get(storageKey);
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) {
      const parsed: unknown = JSON.parse(existing);
      if (parsed && typeof parsed === "object" && "key" in parsed && "expiresAt" in parsed
        && typeof parsed.key === "string" && typeof parsed.expiresAt === "number") {
        operation = { key: parsed.key, expiresAt: parsed.expiresAt };
      }
    } else {
      operationCache.delete(storageKey);
      operation = undefined;
    }
  } catch {
    // Use the in-memory operation when browser storage is unavailable.
  }
  if (!operation || operation.expiresAt <= Date.now()) {
    operation = { key: createOperationId(), expiresAt: Date.now() + 15 * 60 * 1000 };
  }
  operationCache.set(storageKey, operation);
  try { window.sessionStorage.setItem(storageKey, JSON.stringify(operation)); } catch { /* Memory cache preserves retries. */ }
  return operation.key;
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

const getCheckoutInvocationError = async (error: unknown) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload: unknown = await context.clone().json();
        if (payload && typeof payload === "object" && "error" in payload) {
          const message = (payload as { error?: unknown }).error;
          if (typeof message === "string" && message.trim()) return message.trim().slice(0, 300);
        }
      } catch {
        // Fall back to the safe client-facing message below.
      }
    }
  }
  return "Unable to open secure PayMongo checkout. Please try again.";
};

export async function createPayMongoCheckout(booking: CheckoutBooking): Promise<PayMongoCheckout> {
  const slotId = getSlotId(booking);
  if (!booking?.id && (!booking?.serviceId || !slotId)) {
    throw new Error("Choose an available time before starting payment.");
  }

  const rawResponse: unknown = await supabase.functions.invoke<CheckoutFunctionResponse>(
    "create-paymongo-checkout",
    {
      body: {
        bookingId: booking.id || null,
        serviceId: booking.serviceId || null,
        slotId,
        quoteVersion: booking.quoteVersion || null,
        paymentPlan: booking.paymentPlan || "downpayment",
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

  if (response.error) {
    const message = await getCheckoutInvocationError(response.error);
    if (message === "Payment reservation has expired. Please choose your time again.") {
      const storageKey = getIdempotencyStorageKey(booking);
      operationCache.delete(storageKey);
      try { window.sessionStorage.removeItem(storageKey); } catch { /* Storage can be disabled. */ }
    }
    throw new Error(message);
  }
  if (typeof data?.error === "string" && data.error) throw new Error(data.error);

  const paymentAttemptId = typeof data?.paymentAttemptId === "string"
    ? data.paymentAttemptId.trim()
    : "";
  if (!paymentAttemptId) throw new Error("The payment attempt could not be created.");
  const bookingId = typeof data?.bookingId === "string" ? data.bookingId.trim() : "";
  if (!bookingId) throw new Error("The booking reservation could not be created.");
  const holdExpiresAt = typeof data?.holdExpiresAt === "string" && data.holdExpiresAt
    ? data.holdExpiresAt
    : null;

  return {
    bookingId,
    checkoutUrl: validateCheckoutUrl(data?.checkoutUrl),
    holdExpiresAt,
    paymentAttemptId,
  };
}

export function redirectToPayMongo(checkout: PayMongoCheckout) {
  window.location.assign(checkout.checkoutUrl);
}
