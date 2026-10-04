import { beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase";
import { fetchSellerBookings } from "@/features/bookings/services/bookingService";
import { getActiveReplacementSchedules } from "@/features/bookings/services/replacementSchedules";
import { loadWorkerProfileServices } from "@/features/work/services/workerService";
import { fetchProviderDashboardSnapshot } from "./providerDashboardService";

vi.mock("@/integrations/supabase", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/features/bookings/services/bookingService", () => ({ fetchSellerBookings: vi.fn() }));
vi.mock("@/features/bookings/services/replacementSchedules", () => ({ getActiveReplacementSchedules: vi.fn() }));
vi.mock("@/features/work/services/workerService", () => ({ loadWorkerProfileServices: vi.fn() }));

const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), order: vi.fn(), limit: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: [], error: null });
  vi.mocked(supabase, { deep: true }).from.mockReturnValue(query);
  vi.mocked(loadWorkerProfileServices).mockResolvedValue({ sellerData: {}, sellerDbServices: [], sellerRatingAggregate: {} } as never);
});

it("shows the accepted replacement on the provider's upcoming schedule", async () => {
  vi.mocked(fetchSellerBookings).mockResolvedValue([{
    id: "booking-1", status: "Dispute Open", serviceType: "Home repair", clientName: "Client",
    raw: { booking: { start_ts: "2026-09-28T08:00:00+08:00" } },
  }] as never);
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map([["booking-1", {
    bookingId: "booking-1", caseId: "case-1", status: "accepted",
    startAt: "2026-10-10T08:00:00+08:00", endAt: "2026-10-10T09:00:00+08:00",
  }]]));
  const snapshot = await fetchProviderDashboardSnapshot("provider-1", {});
  expect(snapshot.nextAppointment?.schedule).toContain("Oct 10");
  expect(snapshot.nextAppointment?.status).toBe("Replacement visit confirmed");
  expect(snapshot.actions).toContainEqual(expect.objectContaining({ title: "Replacement visit confirmed", bookingId: "booking-1" }));
});
