import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn<(
    name: string,
    options: { body: { bookingId: string | null; idempotencyKey: string; paymentPlan: string; quoteVersion: string | number | null; serviceId: string | number | null; slotId: string | number | null } },
  ) => Promise<{
    data: { bookingId: string; checkoutUrl: string; holdExpiresAt: string | null; paymentAttemptId: string };
    error: (Error & { context?: Response }) | null;
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
        bookingId: "booking-1",
        holdExpiresAt: "2026-10-01T10:15:00Z",
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
      data: { bookingId: "booking-1", checkoutUrl: "https://example.com/fake", holdExpiresAt: null, paymentAttemptId: "attempt-1" },
      error: null,
    });

    await expect(createPayMongoCheckout({ id: "booking-1" })).rejects.toThrow(
      "invalid checkout link",
    );
  });

  it("uses separate operations for a different slot or quote version", async () => {
    invoke.mockResolvedValue({ data: { bookingId: "booking-1", checkoutUrl: "https://checkout.paymongo.com/test", holdExpiresAt: null, paymentAttemptId: "attempt-1" }, error: null });
    await createPayMongoCheckout({ id: "booking-1", selectedSlot: { slotId: 1 } });
    await createPayMongoCheckout({ id: "booking-1", selectedSlot: { slotId: 2 } });
    await createPayMongoCheckout({ id: "booking-1", quoteVersion: 2 });
    expect(new Set(invoke.mock.calls.map((call) => call[1].body.idempotencyKey)).size).toBe(3);
  });

  it("starts a new operation after the reservation expires", async () => {
    const response = { data: { bookingId: "booking-1", checkoutUrl: "https://checkout.paymongo.com/test", holdExpiresAt: null, paymentAttemptId: "attempt-1" }, error: null };
    invoke.mockResolvedValue(response);
    const booking = { id: "booking-1" };
    await createPayMongoCheckout(booking);
    const error = Object.assign(new Error("Expired"), { context: new Response(JSON.stringify({ error: "Payment reservation has expired. Please choose your time again." }), { status: 409 }) });
    invoke.mockResolvedValueOnce({ data: undefined as never, error });
    await expect(createPayMongoCheckout(booking)).rejects.toThrow("expired");
    await createPayMongoCheckout(booking);
    expect(invoke.mock.calls[0]?.[1].body.idempotencyKey).toBe(invoke.mock.calls[1]?.[1].body.idempotencyKey);
    expect(invoke.mock.calls[2]?.[1].body.idempotencyKey).not.toBe(invoke.mock.calls[0]?.[1].body.idempotencyKey);
  });

  it("preserves the safe server explanation when checkout is rejected", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "Selected time is no longer available." }), {
        headers: { "Content-Type": "application/json" },
        status: 409,
      }),
    });
    invoke.mockResolvedValue({ data: undefined as never, error });

    await expect(createPayMongoCheckout({ id: "booking-1" })).rejects.toThrow(
      "Selected time is no longer available.",
    );
  });
});
