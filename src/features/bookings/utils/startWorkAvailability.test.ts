import { describe, expect, it } from "vitest";

import type { BookingActionRecord } from "@/features/bookings/types/booking-action-record";
import { getStartWorkAvailability } from "./startWorkAvailability";

const now = Date.parse("2026-10-05T09:00:00+08:00");
const booking: BookingActionRecord = {
  id: "booking-1",
  paymentStatus: "paid",
  scheduleStatus: "confirmed",
  deliveryStatus: "not_delivered",
  disputeStatus: "none",
  appointmentStartAt: "2026-10-07T13:00:00+08:00",
  raw: { booking: { status: "confirmed" } },
};

describe("getStartWorkAvailability", () => {
  it("shows the opening time in Philippine time until 30 minutes before the visit", () => {
    const early = getStartWorkAvailability(booking, "provider", now);
    expect(early.visible).toBe(true);
    expect(early.enabled).toBe(false);
    expect(early.reason).toMatch(/Oct 7, 2026, 12:30 PM PHT, 30 minutes before the appointment/);
    expect(getStartWorkAvailability(booking, "provider", Date.parse("2026-10-07T12:30:00+08:00")))
      .toEqual({ visible: true, enabled: true, reason: "" });
  });

  it("explains payment, support, and cancellation blocks without enabling work", () => {
    expect(getStartWorkAvailability({ ...booking, paymentStatus: "partially_paid" }, "provider", now).reason)
      .toMatch(/full payment is verified/);
    expect(getStartWorkAvailability({ ...booking, disputeStatus: "open" }, "provider", now).reason)
      .toMatch(/support case is open/);
    expect(getStartWorkAvailability({ ...booking, cancellationStatus: "requested" }, "provider", now).reason)
      .toMatch(/cancellation request/);
    expect(getStartWorkAvailability({ ...booking, cancellationStatus: "declined" }, "provider", now).enabled)
      .toBe(false);
  });

  it("does not show start work for clients or jobs already in progress", () => {
    expect(getStartWorkAvailability(booking, "client", now).visible).toBe(false);
    expect(getStartWorkAvailability({ ...booking, raw: { booking: { status: "in_progress" } } }, "provider", now).visible).toBe(false);
  });
});
