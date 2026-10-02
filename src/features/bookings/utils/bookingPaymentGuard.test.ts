import { describe, expect, it } from "vitest";
import { isBookingFullyFunded } from "./bookingPaymentGuard";

describe("work payment protection", () => {
  it.each([
    { paymentStatus: "partially_paid", balanceDueAmount: 400 },
    { paymentStatus: "paid", balanceDueAmount: 400 },
    { paymentStatus: "paid", balanceDueAmount: 0, totalChargedAmount: 864, amountPaid: 464 },
    { paymentStatus: "paid", balanceDueAmount: "invalid" },
    { paymentStatus: "refund_pending", balanceDueAmount: 0 },
  ])("blocks work when funding is incomplete: %j", (booking) => expect(isBookingFullyFunded(booking)).toBe(false));
  it("permits fully paid installments", () => expect(isBookingFullyFunded({ paymentStatus: "paid", balanceDueAmount: 0, totalChargedAmount: 864, amountPaid: 864 })).toBe(true));
});
