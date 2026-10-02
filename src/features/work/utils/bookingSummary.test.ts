import { describe, expect, it } from "vitest";

import { countCompletedBookings } from "./bookingSummary";

describe("countCompletedBookings", () => {
  it("matches the Completed tab without counting delivered, cancelled, or refunded bookings", () => {
    const transactions = [
      "Completed Service", "Service Stopped", "Service Delivered", "Scheduled",
      "Cancelled", "Cancelled (Cash)", "Refunded", undefined,
    ].map((bookingStatus) => ({ bookingStatus }));

    expect(countCompletedBookings(transactions)).toBe(2);
  });

  it("returns zero when the provider has no bookings", () => {
    expect(countCompletedBookings([])).toBe(0);
  });
});
