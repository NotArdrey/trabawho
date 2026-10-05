import { describe, expect, it } from "vitest";

import { isBookableClientAppointment, isFutureClientBookingDate, philippineDateKey } from "./clientBookingDate";

describe("client booking date in Philippine time", () => {
  const now = new Date("2026-10-05T09:00:00Z"); // 5 PM PHT

  it("rejects today's morning and evening slots, even if a later hour is still ahead", () => {
    expect(isBookableClientAppointment("2026-10-05T01:00:00Z", "2026-10-05T02:00:00Z", now)).toBe(false);
    expect(isBookableClientAppointment("2026-10-05T10:00:00Z", "2026-10-05T11:00:00Z", now)).toBe(false);
  });

  it("allows tomorrow's valid window", () => {
    expect(isBookableClientAppointment("2026-10-06T01:00:00Z", "2026-10-06T02:00:00Z", now)).toBe(true);
  });

  it("uses Philippine midnight regardless of the browser timezone", () => {
    const beforeMidnight = new Date("2026-10-05T15:59:59Z");
    const afterMidnight = new Date("2026-10-05T16:00:00Z");
    expect(philippineDateKey(beforeMidnight)).toBe("2026-10-05");
    expect(philippineDateKey(afterMidnight)).toBe("2026-10-06");
    expect(isFutureClientBookingDate("2026-10-06", beforeMidnight)).toBe(true);
    expect(isFutureClientBookingDate("2026-10-06", afterMidnight)).toBe(false);
  });

  it("rejects invalid and reversed windows", () => {
    expect(isBookableClientAppointment("bad", "2026-10-06T02:00:00Z", now)).toBe(false);
    expect(isBookableClientAppointment("2026-10-06T02:00:00Z", "2026-10-06T01:00:00Z", now)).toBe(false);
  });
});
