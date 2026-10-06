import { describe, expect, it } from "vitest";
import { buildDashboardModel, type DashboardSnapshot } from "./dashboardModel";

const now = new Date("2026-10-06T10:00:00+08:00");
const empty: DashboardSnapshot = { user: { id: "client-1" }, bookings: [], conversations: [], messages: [], unreadMessageCount: 0 };

describe("client overview schedule and activity", () => {
  it("shows the active replacement in Philippine time, not the original disputed appointment", () => {
    const model = buildDashboardModel({ ...empty, bookings: [
      { id: "disputed-1", serviceType: "Apartment cleaning", workerName: "Maria", status: "Dispute Open",
        activeReplacementStartAt: "2026-10-10T16:00:00+08:00", raw: { booking: { start_ts: "2026-10-05T23:00:00+08:00" } } },
      { id: "disputed-2", status: "Dispute Open", raw: { booking: { start_ts: "2026-10-09T11:00:00+08:00" } } },
    ] }, false, now);
    expect(model.upcomingCount).toBe(1);
    expect(model.upcomingBookings[0]).toMatchObject({ id: "disputed-1", schedule: "Oct 10, 4:00 PM", isReplacement: true });
    expect(model.upcomingBookings.some((booking) => booking.id === "disputed-2")).toBe(false);
    expect(model.metrics.find((metric) => metric.id === "upcoming")?.detail).toBe("Next visit Oct 10, 4:00 PM PHT");
  });

  it("counts all future visits while listing the next three and excludes past and cancelled appointments", () => {
    const bookings = [7, 8, 9, 10, 11].map((day) => ({ id: `booking-${day}`, status: "Payment Confirmed", startTs: `2026-10-${day.toString().padStart(2, "0")}T13:00:00+08:00` }));
    const model = buildDashboardModel({ ...empty, bookings: [
      { id: "past", status: "Payment Confirmed", startTs: "2026-10-05T13:00:00+08:00" },
      { id: "cancelled", status: "Cancelled", startTs: "2026-10-12T13:00:00+08:00" }, ...bookings,
    ] }, false, now);
    expect(model.upcomingCount).toBe(5);
    expect(model.upcomingBookings.map((booking) => booking.id)).toEqual(["booking-7", "booking-8", "booking-9"]);
    expect(model.metrics.find((metric) => metric.id === "upcoming")?.value).toBe("5");
  });

  it("describes the current booking state rather than stale payment-proof metadata", () => {
    const model = buildDashboardModel({ ...empty, bookings: [
      { id: "cancelled", serviceType: "Laundry", status: "Cancelled", paymentProofSubmitted: true,
        raw: { booking: { updated_at: "2026-10-06T09:00:00+08:00" } } },
      { id: "disputed", serviceType: "Cleaning", status: "Dispute Open", paymentProofSubmitted: true,
        raw: { booking: { updated_at: "2026-10-06T08:00:00+08:00" } } },
    ] }, false, now);
    expect(model.recentUpdates.map((update) => update.title)).toEqual(["Booking cancelled", "Support case open"]);
    expect(model.recentUpdates.map((update) => update.category)).toEqual(["cancelled", "support"]);
    expect(model.recentUpdates[0].href).toContain("focus=cancelled");
  });

  it("dates a replacement update from participant acceptance, not the original booking edit", () => {
    const model = buildDashboardModel({ ...empty, bookings: [
      { id: "replacement", status: "Dispute Open", activeReplacementStartAt: "2026-10-10T16:00:00+08:00",
        activeReplacementAcceptedAt: "2026-10-06T09:00:00+08:00", raw: { booking: { updated_at: "2026-10-05T20:00:00+08:00" } } },
      { id: "other", status: "Payment Confirmed", raw: { booking: { updated_at: "2026-10-06T08:00:00+08:00" } } },
    ] }, false, now);
    expect(model.recentUpdates[0].title).toBe("Replacement visit confirmed");
    expect(model.recentUpdates[0].category).toBe("visit");
  });

  it("matches booking filters for terminal refunds and client actions", () => {
    const model = buildDashboardModel({ ...empty, bookings: [
      { id: "refunded", status: "Payment Confirmed", paymentStatus: "paid", refundSimulated: true, startTs: "2026-10-10T13:00:00+08:00" },
      { id: "expired", status: "Reservation Expired" },
    ] }, false, now);
    expect(model.metrics.find((metric) => metric.id === "active")?.value).toBe("1");
    expect(model.metrics.find((metric) => metric.id === "actions")?.value).toBe("1");
    expect(model.upcomingCount).toBe(0);
    expect(model.recentUpdates.some((update) => update.title === "Payment confirmed")).toBe(false);
    expect(model.recentUpdates.find((update) => update.title === "Test refund recorded")?.category).toBe("refund");
  });
});
