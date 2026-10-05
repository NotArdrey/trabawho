import { describe, expect, it } from "vitest";

import { findProviderBookingConflicts, type ProviderCalendarBooking } from "./providerBookingConflicts";

const now = Date.parse("2026-10-05T00:00:00Z");
const booking = (overrides: Partial<ProviderCalendarBooking> = {}): ProviderCalendarBooking => ({
  id: "first", sellerId: "provider-1", clientName: "First client", serviceType: "Garden cleanup",
  scheduleStatus: "confirmed",
  raw: { booking: { status: "confirmed", start_ts: "2026-10-10T01:00:00Z", end_ts: "2026-10-10T02:00:00Z" } },
  ...overrides,
});

describe("provider booking conflict warning", () => {
  it("finds overlapping jobs across services for the same provider", () => {
    const first = booking();
    const second = booking({ id: "second", serviceType: "House painting", clientName: "Second client",
      raw: { booking: { status: "confirmed", start_ts: "2026-10-10T01:30:00Z", end_ts: "2026-10-10T02:30:00Z" } } });
    expect(findProviderBookingConflicts(first, [first, second], now)).toEqual([{
      bookingId: "second", serviceType: "House painting", clientName: "Second client", startAt: "2026-10-10T01:30:00Z",
    }]);
    expect(findProviderBookingConflicts(second, [first, second], now)).toHaveLength(1);
  });

  it("does not treat a client's bookings with different providers as a provider conflict", () => {
    expect(findProviderBookingConflicts(booking(), [booking({ id: "other", sellerId: "provider-2" })], now)).toEqual([]);
  });

  it("uses half-open windows, so back-to-back jobs are allowed", () => {
    const next = booking({ id: "next", raw: { booking: { status: "confirmed",
      start_ts: "2026-10-10T02:00:00Z", end_ts: "2026-10-10T03:00:00Z" } } });
    expect(findProviderBookingConflicts(booking(), [next], now)).toEqual([]);
  });

  it("excludes cancelled, refunded, completed, and expired holds", () => {
    const peers = ["cancelled", "refunded", "completed"].map((status) => booking({ id: status, raw: {
      booking: { status, start_ts: "2026-10-10T01:00:00Z", end_ts: "2026-10-10T02:00:00Z" },
    } }));
    peers.push(booking({ id: "expired-hold", scheduleStatus: "held", holdExpiresAt: "2026-10-04T00:00:00Z" }));
    expect(findProviderBookingConflicts(booking(), peers, now)).toEqual([]);
  });

  it("includes live checkout holds and reschedule requests", () => {
    const peers = [booking({ id: "held", scheduleStatus: "held", holdExpiresAt: "2026-10-05T00:15:00Z" }),
      booking({ id: "reschedule", scheduleStatus: "reschedule_requested" })];
    expect(findProviderBookingConflicts(booking(), peers, now).map((conflict) => conflict.bookingId)).toEqual(["held", "reschedule"]);
  });

  it("finds an accepted replacement visit even when the other original visit does not overlap", () => {
    const peer = booking({ id: "replacement", raw: { booking: { status: "confirmed",
      start_ts: "2026-10-11T01:00:00Z", end_ts: "2026-10-11T02:00:00Z" } } });
    const replacement = new Map([["replacement", { status: "accepted",
      startAt: "2026-10-10T01:30:00Z", endAt: "2026-10-10T02:30:00Z" }]]);
    expect(findProviderBookingConflicts(booking(), [peer], now, replacement)).toHaveLength(1);
    replacement.set("replacement", { ...replacement.get("replacement")!, status: "completed" });
    expect(findProviderBookingConflicts(booking(), [peer], now, replacement)).toEqual([]);
  });

  it("does not invent conflicts for missing or invalid appointment data", () => {
    expect(findProviderBookingConflicts(booking(), [booking({ id: "no-end", raw: {
      booking: { status: "confirmed", start_ts: "2026-10-10T01:00:00Z" },
    } })], now)).toEqual([]);
  });
});
