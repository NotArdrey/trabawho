import { describe, expect, it } from "vitest";

import { ownsOpenSandboxCheckout, sandboxCheckoutEnabled, sandboxReturnUrlAllowed } from "./paymongoSandboxAccess";

const checkout = { attemptId: "00000000-0000-0000-0000-000000000001", checkoutSessionId: "cs_test123",
  checkoutUrl: "https://checkout.paymongo.com/test123", kind: "booking" as const };
const attempt = { id: checkout.attemptId, buyer_id: "buyer-1", checkout_session_id: checkout.checkoutSessionId,
  checkout_url: checkout.checkoutUrl, environment: "test", status: "awaiting_payment", expires_at: "2099-01-01T00:00:00Z" };

describe("deployed sandbox checkout access", () => {
  it("requires an explicit server flag and a test-only secret", () => {
    expect(sandboxCheckoutEnabled("true", "sk_test_example")).toBe(true);
    expect(sandboxCheckoutEnabled("true", "sk_live_example")).toBe(false);
    expect(sandboxCheckoutEnabled(undefined, "sk_test_example")).toBe(false);
  });
  it("only allows the signed-in owner to complete the exact unexpired test attempt", () => {
    expect(ownsOpenSandboxCheckout(attempt, checkout, "buyer-1")).toBe(true);
    expect(ownsOpenSandboxCheckout(attempt, checkout, "other-user")).toBe(false);
    expect(ownsOpenSandboxCheckout({ ...attempt, environment: "live" }, checkout, "buyer-1")).toBe(false);
    expect(ownsOpenSandboxCheckout({ ...attempt, status: "paid" }, checkout, "buyer-1")).toBe(false);
    expect(ownsOpenSandboxCheckout({ ...attempt, expires_at: "2020-01-01T00:00:00Z" }, checkout, "buyer-1")).toBe(false);
    expect(ownsOpenSandboxCheckout(attempt, { ...checkout, checkoutUrl: "https://checkout.paymongo.com/other" }, "buyer-1")).toBe(false);
  });
  it("allows boost ownership and only app payment-verification returns", () => {
    expect(ownsOpenSandboxCheckout({ ...attempt, seller_id: "seller-1" }, { ...checkout, kind: "boost" }, "seller-1")).toBe(true);
    expect(sandboxReturnUrlAllowed("https://app.example/bookings?payment=verifying", "https://app.example")).toBe(true);
    expect(sandboxReturnUrlAllowed("https://app.example/profile?boostPayment=verifying", "https://app.example")).toBe(true);
    expect(sandboxReturnUrlAllowed("https://other.example/bookings?payment=verifying", "https://app.example")).toBe(false);
  });
});
