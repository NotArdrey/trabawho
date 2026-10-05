import { describe, expect, it } from "vitest";
import { isBookingActionNeeded, matchesBookingDisplayFilter, matchesBookingHubFilter } from "./bookingFilters";

describe("booking filter meaning", () => {
  it.each(["Cancelled", "Cancelled (Cash)", "Completed Service", "Service Stopped", "Refunded"])("does not treat stale payment and delivery flags on %s as outstanding work", (status) => {
    const booking = { status, paymentStatus: "partially_paid", deliveryStatus: "seller_claimed" };
    expect(matchesBookingHubFilter(booking, "payment-due", "purchases")).toBe(false);
    expect(matchesBookingHubFilter(booking, "delivered", "incoming")).toBe(false);
    expect(isBookingActionNeeded(booking, "purchases")).toBe(false);
    expect(isBookingActionNeeded({ ...booking, paymentStatus: "pending_provider" }, "incoming")).toBe(false);
  });
  it("distinguishes provider verification from a client payment due", () => {
    const booking = { status: "Cash Verification Pending", paymentStatus: "pending_provider", paymentMethod: "after-service-cash" };
    expect(matchesBookingHubFilter(booking, "payment-due", "purchases")).toBe(false);
    expect(isBookingActionNeeded(booking, "incoming")).toBe(true);
    expect(matchesBookingDisplayFilter(booking, "cash-approvals")).toBe(true);
    expect(matchesBookingDisplayFilter({ ...booking, status: "Service Scheduled", paymentStatus: "paid" }, "cash-approvals")).toBe(false);
  });
  it("includes outstanding balances and excludes paid or refunded payments", () => {
    expect(matchesBookingHubFilter({ status: "Active Service", paymentStatus: "partially_paid" }, "payment-due", "purchases")).toBe(true);
    expect(matchesBookingHubFilter({ status: "Payment Pending", paymentStatus: "paid" }, "payment-due", "purchases")).toBe(false);
    expect(matchesBookingHubFilter({ status: "Refund Processing", paymentStatus: "partially_paid" }, "payment-due", "purchases")).toBe(false);
  });
  it("does not silently show all records for an unknown filter", () => {
    expect(matchesBookingHubFilter({ status: "Active Service" }, "unknown", "incoming")).toBe(false);
  });
  it("keeps a cancelled visit in history and tracks its refund separately", () => {
    const booking = { status: "Cancelled", paymentStatus: "refund_pending" };
    expect(matchesBookingHubFilter(booking, "cancelled", "purchases")).toBe(true);
    expect(matchesBookingHubFilter(booking, "refunds", "purchases")).toBe(true);
    expect(matchesBookingHubFilter(booking, "active", "purchases")).toBe(false);
    expect(matchesBookingHubFilter(booking, "payment-due", "purchases")).toBe(false);
    expect(matchesBookingHubFilter({ ...booking, paymentStatus: "refunded" }, "refunds", "incoming")).toBe(true);
  });
});
