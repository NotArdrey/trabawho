import { describe, expect, it } from "vitest";
import { summarizeVerifiedTestPayments } from "./paymentSummary";

describe("summarizeVerifiedTestPayments", () => {
  it("preserves the original collected amount after a verified refund", () => {
    const payments = [
      { id: "a", amount: 377, payment_id: "pay_a", status: "refunded" },
      { id: "b", amount: 325, payment_id: "pay_b", status: "paid" },
      { id: "manual", amount: 950, payment_id: null, status: "refunded" },
    ];
    const events = ["a", "b"].map((payment_attempt_id) => ({
      payment_attempt_id, event_type: "checkout_session.payment.paid", status: "processed", livemode: false, processed_at: "2026-10-05T01:00:00Z",
    }));
    expect(summarizeVerifiedTestPayments(payments, events)).toEqual({ collected: 702, refunded: 377, refundable: 325 });
  });

  it("does not count unverified or live-mode payment labels", () => {
    expect(summarizeVerifiedTestPayments([{ id: "a", amount: 500, payment_id: "pay_a", status: "refunded" }],
      [{ payment_attempt_id: "a", event_type: "checkout_session.payment.paid", status: "processed", livemode: true, processed_at: "2026-10-05T01:00:00Z" }]))
      .toEqual({ collected: 0, refunded: 0, refundable: 0 });
  });
});
