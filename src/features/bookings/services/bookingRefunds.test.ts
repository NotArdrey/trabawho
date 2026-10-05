import { beforeEach, expect, it, vi } from "vitest";
import { hasVerifiedRefundPayment } from "./bookingRefunds";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({ supabase: { rpc } }));

beforeEach(() => { vi.clearAllMocks(); });

it("uses the server-owned provider verification result", async () => {
  rpc.mockResolvedValueOnce({ data: true, error: null });
  await expect(hasVerifiedRefundPayment("booking-1")).resolves.toBe(true);
  expect(rpc).toHaveBeenCalledWith("has_verified_refund_payment", { p_booking_id: "booking-1" });
});

it("treats a booking without a verified provider event as ineligible", async () => {
  rpc.mockResolvedValueOnce({ data: false, error: null });
  await expect(hasVerifiedRefundPayment("booking-1")).resolves.toBe(false);
});

it("does not imply ineligibility when verification could not be loaded", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
  await expect(hasVerifiedRefundPayment("booking-1")).rejects.toThrow(/could not be checked/);
});
