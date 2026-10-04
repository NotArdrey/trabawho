import { beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase";
import { getActiveReplacementSchedules } from "./replacementSchedules";

vi.mock("@/integrations/supabase", () => ({ supabase: { from: vi.fn() } }));

const visitQuery = {
  select: vi.fn(), in: vi.fn(), order: vi.fn(),
};
const slotQuery = { select: vi.fn(), in: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  visitQuery.select.mockReturnValue(visitQuery);
  visitQuery.in.mockReturnValue(visitQuery);
  slotQuery.select.mockReturnValue(slotQuery);
  vi.mocked(supabase, { deep: true }).from.mockImplementation((table) =>
    (table === "booking_case_replacement_visits" ? visitQuery : slotQuery) as never);
});

it("uses the confirmed replacement slot as the effective booking schedule", async () => {
  visitQuery.order.mockResolvedValue({ data: [{ booking_id: "booking-1", case_id: "case-1", slot_id: 12,
    status: "accepted", accepted_at: "2026-10-04T08:00:00Z" }], error: null });
  slotQuery.in.mockResolvedValue({ data: [{ id: 12, start_ts: "2026-10-10T08:00:00+08:00", end_ts: "2026-10-10T09:00:00+08:00" }], error: null });
  const schedules = await getActiveReplacementSchedules(["booking-1"]);
  expect(visitQuery.in).toHaveBeenCalledWith("status", ["accepted", "delivered", "completed"]);
  expect(schedules.get("booking-1")).toEqual({ bookingId: "booking-1", caseId: "case-1", status: "accepted",
    startAt: "2026-10-10T08:00:00+08:00", endAt: "2026-10-10T09:00:00+08:00" });
});

it("returns no replacement when no accepted visit exists", async () => {
  visitQuery.order.mockResolvedValue({ data: [], error: null });
  expect((await getActiveReplacementSchedules(["booking-1"])).size).toBe(0);
  expect(slotQuery.in).not.toHaveBeenCalled();
});

it("reports a booked slot hidden by access policy instead of silently showing the old time", async () => {
  visitQuery.order.mockResolvedValue({ data: [{ booking_id: "booking-1", case_id: "case-1", slot_id: 12,
    status: "accepted", accepted_at: "2026-10-04T08:00:00Z" }], error: null });
  slotQuery.in.mockResolvedValue({ data: [], error: null });
  await expect(getActiveReplacementSchedules(["booking-1"])).rejects.toThrow(/not visible to this account/);
});
