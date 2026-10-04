import { beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase";
import { hasVerifiedRefundPayment } from "./bookingRefunds";

vi.mock("@/integrations/supabase", () => ({ supabase: { from: vi.fn() } }));

const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), not: vi.fn(), limit: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.not.mockReturnValue(query);
  vi.mocked(supabase, { deep: true }).from.mockReturnValue(query);
});

it("matches the refund request's provider-backed payment requirement", async () => {
  query.limit.mockResolvedValue({ data: [{ id: "attempt-1" }], error: null });
  await expect(hasVerifiedRefundPayment("booking-1")).resolves.toBe(true);
  expect(query.eq).toHaveBeenCalledWith("booking_id", "booking-1");
  expect(query.in).toHaveBeenCalledWith("status", ["paid", "late_paid"]);
  expect(query.not).toHaveBeenCalledWith("payment_id", "is", null);
  expect(query.limit).toHaveBeenCalledWith(1);
});

it("treats a booking without a verified attempt as ineligible", async () => {
  query.limit.mockResolvedValue({ data: [], error: null });
  await expect(hasVerifiedRefundPayment("booking-1")).resolves.toBe(false);
});

it("does not imply ineligibility when verification could not be loaded", async () => {
  query.limit.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(hasVerifiedRefundPayment("booking-1")).rejects.toThrow(/could not be checked/);
});
