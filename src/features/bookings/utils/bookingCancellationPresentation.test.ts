import { describe, expect, it } from "vitest";

import { bookingRefundStage, canRequestBookingCancellation, canReviewBookingCancellation } from "./bookingCancellationPresentation";

describe("paid cancellation presentation", () => {
  const booking = { status: "Payment Confirmed", paymentStatus: "paid", buyerId: "buyer", sellerId: "seller",
    cancellationStatus: "requested", cancellationRequestedBy: "buyer", disputeStatus: "none" };

  it("allows only the other participant to review a request", () => {
    expect(canReviewBookingCancellation(booking, true)).toBe(true);
    expect(canReviewBookingCancellation(booking, false)).toBe(false);
    expect(canReviewBookingCancellation({ ...booking, cancellationRequestedBy: "seller" }, false)).toBe(true);
  });

  it("allows either participant to request paid cancellation, but not on active cases", () => {
    const available = { ...booking, cancellationStatus: "none", cancellationRequestedBy: null };
    expect(canRequestBookingCancellation(available, true)).toBe(true);
    expect(canRequestBookingCancellation(available, false)).toBe(true);
    expect(canRequestBookingCancellation({ ...available, disputeStatus: "open" }, true)).toBe(false);
    expect(canRequestBookingCancellation({ ...available, status: "Cancelled" }, false)).toBe(false);
  });

  it("presents the payment result separately from cancellation", () => {
    expect(bookingRefundStage({ status: "Cancelled", paymentStatus: "refund_pending" })).toBe("review");
    expect(bookingRefundStage({ status: "Cancelled", paymentStatus: "refunded", refundSimulated: true })).toBe("simulated");
    expect(bookingRefundStage({ status: "Payment Confirmed", paymentStatus: "refund_pending" })).toBe(null);
  });
});
