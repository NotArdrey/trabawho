import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase";
import { fetchSellerBookings } from "@/features/bookings/services/bookingService";
import { getActiveReplacementSchedules } from "@/features/bookings/services/replacementSchedules";
import { loadWorkerProfileServices } from "@/features/work/services/workerService";
import { fetchProviderDashboardSnapshot } from "./providerDashboardService";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({ supabase: { from: vi.fn(), rpc } }));
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
  rpc.mockResolvedValue({ data: [], error: null });
  vi.mocked(loadWorkerProfileServices).mockResolvedValue({ sellerData: {}, sellerDbServices: [], sellerRatingAggregate: {} } as never);
});

it("lists each active service with its own bookable slots and next opening", async () => {
  vi.mocked(fetchSellerBookings).mockResolvedValue([] as never);
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map());
  vi.mocked(loadWorkerProfileServices).mockResolvedValue({ sellerData: {}, sellerRatingAggregate: {}, sellerDbServices: [
    { id: 11, title: "Home repair", short_description: "Appliance and fixture repairs", active: true, metadata: { booking_mode: "with-slots" } },
    { id: 12, title: "Apartment cleaning", active: true, metadata: { booking_mode: "with-slots" } },
    { id: 13, title: "Custom project", active: true, price_type: "custom", metadata: { booking_mode: "calendar-only" } },
    { id: 14, title: "Deleted service", active: false, metadata: { deleted_from_work: true } },
  ] } as never);
  rpc.mockResolvedValue({ data: [
    { id: 1, service_id: 11, start_ts: "2099-10-10T16:00:00+08:00" },
    { id: 2, service_id: 11, start_ts: "2099-10-11T16:00:00+08:00" },
    { id: 3, service_id: 12, start_ts: "2099-10-12T13:00:00+08:00" },
  ], error: null });

  const snapshot = await fetchProviderDashboardSnapshot("provider-1", {});
  expect(rpc).toHaveBeenCalledWith("list_available_service_slots", { p_service_ids: [11, 12] });
  expect(snapshot.serviceHealth).toMatchObject({ totalListings: 3, activeListings: 3, availableSlots: 3 });
  expect(snapshot.serviceListings).toEqual([
    expect.objectContaining({ id: 11, title: "Home repair", description: "Appliance and fixture repairs", availableSlots: 2, nextOpenAt: "Oct 10, 4:00 PM PHT" }),
    expect.objectContaining({ id: 12, title: "Apartment cleaning", availableSlots: 1, nextOpenAt: "Oct 12, 1:00 PM PHT" }),
    expect.objectContaining({ id: 13, title: "Custom project", bookingType: "Request-based booking", availableSlots: 0, nextOpenAt: null }),
  ]);
});
afterEach(() => vi.useRealTimers());

it("shows the accepted replacement on the provider's upcoming schedule", async () => {
  vi.mocked(fetchSellerBookings).mockResolvedValue([{
    id: "booking-1", status: "Dispute Open", serviceType: "Home repair", clientName: "Client",
    raw: { booking: { start_ts: "2026-09-28T08:00:00+08:00" } },
  }] as never);
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map([["booking-1", {
    bookingId: "booking-1", caseId: "case-1", status: "accepted",
    startAt: "2099-10-10T08:00:00+08:00", endAt: "2099-10-10T09:00:00+08:00",
  }]]));
  const snapshot = await fetchProviderDashboardSnapshot("provider-1", {});
  expect(snapshot.nextAppointment?.schedule).toContain("Oct 10");
  expect(snapshot.nextAppointment?.schedule).toContain("PHT");
  expect(snapshot.nextAppointment?.status).toBe("Replacement visit confirmed");
  expect(snapshot.actions).not.toContainEqual(expect.objectContaining({ title: "Active booking update", bookingId: "booking-1" }));
});

it("does not advertise the original disputed appointment without an agreed new time", async () => {
  vi.mocked(fetchSellerBookings).mockResolvedValue([{ id: "booking-1", status: "Dispute Open",
    raw: { booking: { start_ts: "2099-10-12T13:00:00+08:00" } } }] as never);
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map());
  const snapshot = await fetchProviderDashboardSnapshot("provider-1", {});
  expect(snapshot.nextAppointment).toBeNull();
  expect(snapshot.actions).toEqual([]);
});

it("uses the Philippine calendar day for today's visit across timezone boundaries", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T16:30:00Z")); // Oct 10, 12:30 AM in Manila.
  vi.mocked(fetchSellerBookings).mockResolvedValue([{ id: "booking-1", status: "Payment Confirmed", serviceType: "Cleaning",
    raw: { booking: { start_ts: "2026-10-10T16:00:00+08:00" } } }] as never);
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map());
  const snapshot = await fetchProviderDashboardSnapshot("provider-1", {});
  expect(snapshot.todaySchedule).toHaveLength(1);
  expect(snapshot.todaySchedule[0].schedule).toBe("Oct 10, 4:00 PM PHT");
  expect(snapshot.metrics.find((metric) => metric.id === "today")?.value).toBe("1");
});

it("marks cash and refund alerts with the work section that owns the action", async () => {
  vi.mocked(fetchSellerBookings).mockResolvedValue([
    { id: "cash-1", status: "Cash Verification Pending", cashConfirmationStatus: "pending-worker-review" },
    { id: "refund-1", status: "Refund Processing", refundStatus: "requested" },
  ] as never);
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map());
  const snapshot = await fetchProviderDashboardSnapshot("provider-1", {});
  expect(snapshot.actions).toContainEqual(expect.objectContaining({ bookingId: "cash-1", destination: "work", workSection: "cash-approvals" }));
  expect(snapshot.actions).toContainEqual(expect.objectContaining({ bookingId: "refund-1", destination: "work", workSection: "refunds" }));
});

it("does not present disputed or refunding payments as verified booking value", async () => {
  vi.mocked(fetchSellerBookings).mockResolvedValue([
    { id: "paid", status: "Payment Confirmed", paymentStatus: "paid", totalAmount: 500 },
    { id: "disputed", status: "Dispute Open", paymentStatus: "paid", totalAmount: 900 },
    { id: "refunding", status: "Payment Confirmed", paymentStatus: "paid", refundStatus: "requested", totalAmount: 600 },
    { id: "simulated", status: "Payment Confirmed", paymentStatus: "paid", refundSimulated: true, totalAmount: 700,
      raw: { booking: { start_ts: "2099-10-13T13:00:00+08:00" } } },
  ] as never);
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map());
  const snapshot = await fetchProviderDashboardSnapshot("provider-1", {});
  expect(snapshot.confirmedEarnings).toMatchObject({ amount: 500, bookingCount: 1 });
  expect(snapshot.metrics.find((metric) => metric.id === "earnings")?.label).toBe("Verified booking value");
  expect(snapshot.nextAppointment).toBeNull();
});
