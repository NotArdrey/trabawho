import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBoostCheckout, forgetBoostCheckoutOperations } from "./gigBoostService";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase", () => ({ supabase: { functions: { invoke } } }));
describe("boost checkout retries", () => {
  beforeEach(() => { vi.clearAllMocks(); window.sessionStorage.clear(); });
  it("retains the operation after an uncertain failure", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error("Network response lost") })
      .mockResolvedValueOnce({ data: { checkoutUrl: "https://checkout.paymongo.com/verified", attemptId: "attempt-1" }, error: null });
    const draft = { serviceId: 101, serviceTitle: "Painting", days: 14, amount: 250 };
    await expect(createBoostCheckout("seller-retry", draft)).rejects.toThrow(/retry/i);
    await expect(createBoostCheckout("seller-retry", draft)).resolves.toMatchObject({ attemptId: "attempt-1" });
    const first: unknown = invoke.mock.calls[0]?.[1];
    const second: unknown = invoke.mock.calls[1]?.[1];
    expect(first).toEqual(second);
  });
  it("starts a fresh checkout after a cancelled attempt", async () => {
    invoke.mockResolvedValue({ data: { checkoutUrl: "https://checkout.paymongo.com/verified", attemptId: "attempt-1" }, error: null });
    const draft = { serviceId: 102, serviceTitle: "Cleaning", days: 7, amount: 350 };
    await createBoostCheckout("seller-cancelled", draft);
    forgetBoostCheckoutOperations("seller-cancelled");
    await createBoostCheckout("seller-cancelled", draft);
    const firstCall: unknown = invoke.mock.calls[0]?.[1];
    const secondCall: unknown = invoke.mock.calls[1]?.[1];
    const first = (firstCall as { body?: { operationId?: string } })?.body?.operationId;
    const second = (secondCall as { body?: { operationId?: string } })?.body?.operationId;
    expect(first).toMatch(/^boost:/);
    expect(second).not.toBe(first);
  });
});
