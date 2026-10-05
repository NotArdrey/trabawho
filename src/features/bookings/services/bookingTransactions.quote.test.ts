import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase", () => ({ supabase: { rpc } }));
vi.mock("@/features/bookings/services/bookingService", () => ({ fetchBookingById: vi.fn(), markBookingDelivered: vi.fn() }));

import { proposeBookingQuote, respondBookingQuote } from "./bookingTransactions";

beforeEach(() => { rpc.mockReset(); });

describe("booking quote transactions", () => {
  it("passes the exact offer to the versioned server RPC", async () => {
    rpc.mockResolvedValue({ data: { quote: { id: "quote-1", version: 2 }, booking: { id: "booking-1" } }, error: null });
    const offer = { bookingId: "booking-1", amount: 950, startAt: "2099-10-06T02:00:00Z", endAt: "2099-10-06T03:00:00Z", scopeSummary: "Garden cleanup", operationId: "quote:stable" };
    await proposeBookingQuote(offer);
    expect(rpc).toHaveBeenCalledWith("propose_booking_quote", {
      p_booking_id: "booking-1", p_amount: 950, p_start_ts: offer.startAt,
      p_end_ts: offer.endAt, p_scope_summary: "Garden cleanup", p_operation_id: "quote:stable",
    });
  });

  it("sends a distinct client response without editing the booking in the browser", async () => {
    rpc.mockResolvedValue({ data: { id: "booking-1" }, error: null });
    await respondBookingQuote({ bookingId: "booking-1", quoteVersion: 2, action: "request_changes", feedback: "Later time", operationId: "response:stable" });
    expect(rpc).toHaveBeenCalledWith("respond_booking_quote", {
      p_booking_id: "booking-1", p_quote_version: 2, p_action: "request_changes",
      p_feedback: "Later time", p_operation_id: "response:stable",
    });
  });

  it("turns calendar and expiry failures into useful, safe messages", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "This provider already has a booking at that time" } });
    await expect(proposeBookingQuote({ bookingId: "booking-1", amount: 950, startAt: "2099-10-06T02:00:00Z", endAt: "2099-10-06T03:00:00Z", scopeSummary: "Garden cleanup" }))
      .rejects.toThrow("already booked");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "This quote has expired" } });
    await expect(respondBookingQuote({ bookingId: "booking-1", quoteVersion: 1, action: "decline", feedback: "" }))
      .rejects.toThrow("expired");
  });

  it("explains missing quote schema without exposing database details", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42703", message: 'column "expires_at" does not exist' } });
    await expect(proposeBookingQuote({ bookingId: "booking-1", amount: 950,
      startAt: "2099-10-06T02:00:00Z", endAt: "2099-10-06T03:00:00Z", scopeSummary: "Garden cleanup" }))
      .rejects.toThrow("booking database needs an update");
  });
});
