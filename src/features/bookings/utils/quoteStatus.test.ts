import { describe, expect, it } from "vitest";

import type { BookingQuote } from "@/features/bookings/types/booking-transactions";
import { isQuoteCheckoutAvailable } from "./quoteStatus";

const quote: BookingQuote = {
  id: "q1", booking_id: "b1", version: 1, amount: 950, currency: "PHP",
  scope_summary: "Garden cleanup", proposed_start_ts: "2099-10-05T00:00:00Z",
  proposed_end_ts: "2099-10-05T01:00:00Z", expires_at: "2099-10-04T00:00:00Z",
  response_note: null, status: "proposed",
};
const now = new Date("2099-10-04T01:00:00Z").getTime();

describe("quote checkout availability", () => {
  it("blocks expired, declined, and change-requested offers", () => {
    expect(isQuoteCheckoutAvailable({ activeQuote: quote }, now)).toBe(false);
    expect(isQuoteCheckoutAvailable({ activeQuote: { ...quote, status: "declined" } }, now)).toBe(false);
    expect(isQuoteCheckoutAvailable({ activeQuote: { ...quote, status: "changes_requested" } }, now)).toBe(false);
  });
  it("allows an accepted checkout hold to finish after quote expiry, but not a new hold", () => {
    const accepted = { ...quote, status: "accepted" as const };
    expect(isQuoteCheckoutAvailable({ activeQuote: accepted, scheduleStatus: "held", holdExpiresAt: "2099-10-04T01:05:00Z" }, now)).toBe(true);
    expect(isQuoteCheckoutAvailable({ activeQuote: accepted, scheduleStatus: "expired", holdExpiresAt: null }, now)).toBe(false);
    expect(isQuoteCheckoutAvailable({ activeQuote: { ...accepted, proposed_start_ts: "2099-10-03T00:00:00Z" }, scheduleStatus: "held", holdExpiresAt: "2099-10-04T01:05:00Z" }, now)).toBe(false);
  });
  it("keeps a verified deposit's balance payment available", () => {
    expect(isQuoteCheckoutAvailable({ activeQuote: { ...quote, status: "accepted" }, paymentStatus: "partially_paid" }, now)).toBe(true);
  });
});
