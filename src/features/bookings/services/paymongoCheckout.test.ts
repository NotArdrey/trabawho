import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn<(
    name: string,
    options: { body: { bookingId: string; idempotencyKey: string } },
  ) => Promise<{
    data: { checkoutUrl: string; paymentAttemptId: string };
    error: Error | null;
  }>>(),
}));

vi.mock("@/integrations/supabase", () => ({
  supabase: { functions: { invoke } },
}));

import { createPayMongoCheckout } from "./paymongoCheckout";

describe("createPayMongoCheckout", () => {
  beforeEach(() => {
    invoke.mockReset();
    window.sessionStorage.clear();
  });

  it("reuses the same idempotency key for checkout retries", async () => {
    invoke.mockResolvedValue({
      data: {
        checkoutUrl: "https://checkout.paymongo.com/test-session",
        paymentAttemptId: "attempt-1",
      },
      error: null,
    });
    const booking = { id: "booking-1", paymentPlan: "full" };

    await createPayMongoCheckout(booking);
    await createPayMongoCheckout(booking);

    const firstKey = invoke.mock.calls[0]?.[1].body.idempotencyKey;
    const secondKey = invoke.mock.calls[1]?.[1].body.idempotencyKey;
    expect(firstKey).toBe(secondKey);
    expect(invoke.mock.calls[0]?.[0]).toBe("create-paymongo-checkout");
    expect(invoke.mock.calls[0]?.[1].body.bookingId).toBe("booking-1");
  });

  it("rejects checkout URLs outside PayMongo", async () => {
    invoke.mockResolvedValue({
      data: { checkoutUrl: "https://example.com/fake", paymentAttemptId: "attempt-1" },
      error: null,
    });

    await expect(createPayMongoCheckout({ id: "booking-1" })).rejects.toThrow(
      "invalid checkout link",
    );
  });
});
