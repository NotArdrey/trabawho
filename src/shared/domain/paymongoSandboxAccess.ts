export type SandboxCheckoutKind = "booking" | "boost";

export interface SandboxCheckoutRequest {
  attemptId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
  kind: SandboxCheckoutKind;
}

export interface SandboxAttempt {
  id?: string;
  buyer_id?: string;
  seller_id?: string;
  checkout_session_id?: string | null;
  checkout_url?: string | null;
  environment?: string;
  status?: string;
  expires_at?: string;
}

export function sandboxCheckoutEnabled(flag: string | undefined, secret: string | undefined): boolean {
  return flag === "true" && Boolean(secret?.startsWith("sk_test_"));
}

export function ownsOpenSandboxCheckout(
  attempt: SandboxAttempt | null, checkout: SandboxCheckoutRequest, userId: string, now = Date.now(),
): boolean {
  if (!attempt || !/^[0-9a-f-]{36}$/i.test(checkout.attemptId) ||
    !/^cs_[A-Za-z0-9_-]+$/.test(checkout.checkoutSessionId)) return false;
  const owner = checkout.kind === "booking" ? attempt.buyer_id : attempt.seller_id;
  return attempt.id === checkout.attemptId && owner === userId && attempt.environment === "test"
    && ["created", "awaiting_payment"].includes(attempt.status || "")
    && attempt.checkout_session_id === checkout.checkoutSessionId
    && attempt.checkout_url === checkout.checkoutUrl
    && Number.isFinite(Date.parse(attempt.expires_at || ""))
    && Date.parse(attempt.expires_at || "") > now;
}

export function sandboxReturnUrlAllowed(rawUrl: string, origin: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.origin === origin && (
      url.pathname === "/bookings" && url.searchParams.get("payment") === "verifying"
      || url.pathname === "/profile" && url.searchParams.get("boostPayment") === "verifying"
    );
  } catch { return false; }
}
