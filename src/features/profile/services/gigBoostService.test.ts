import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBoostCheckout } from "./gigBoostService";

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
});
