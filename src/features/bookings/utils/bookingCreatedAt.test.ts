import { describe, expect, it } from "vitest";

import { formatBookingCreatedAt } from "./bookingCreatedAt";

describe("formatBookingCreatedAt", () => {
  it("shows the booking creation time in Philippine time", () => {
    expect(formatBookingCreatedAt("2026-10-05T05:07:00Z")).toMatch(/Oct 5, 2026.*1:07 PM PHT/);
  });

  it("does not invent a time when the source is absent or invalid", () => {
    expect(formatBookingCreatedAt()).toBeNull();
    expect(formatBookingCreatedAt("not-a-date")).toBeNull();
  });
});
