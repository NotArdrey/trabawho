import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchBookingById } from "@/features/bookings/services/bookingService";
import { respondToRepairClaim } from "./bookingTransactions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({ supabase: { rpc } }));
vi.mock("@/features/bookings/services/bookingService", () => ({ fetchBookingById: vi.fn() }));

describe("respondToRepairClaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: null, error: null });
    vi.mocked(fetchBookingById).mockResolvedValue({ id: "booking-1" } as never);
  });

  it("uses the same operation ID on retries and refreshes the booking", async () => {
    const first = await respondToRepairClaim("booking-1", "case-1", "offer_rework", "I can inspect and redo the original repair.");
    const second = await respondToRepairClaim("booking-1", "case-1", "offer_rework", "I can inspect and redo the original repair.");
    expect(first).toEqual({ id: "booking-1" });
    expect(second).toEqual({ id: "booking-1" });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("respond_to_repair_claim", {
      p_case_id: "case-1", p_action: "offer_rework",
      p_response: "I can inspect and redo the original repair.", p_storage_path: null,
      p_operation_id: "repair-response:case-1",
    });
    expect(fetchBookingById).toHaveBeenCalledTimes(2);
  });

  it("rejects a short response before contacting the server", async () => {
    await expect(respondToRepairClaim("booking-1", "case-1", "offer_rework", "too short"))
      .rejects.toThrow("at least 20 characters");
    expect(rpc).not.toHaveBeenCalled();
  });
});
