interface PaymentRecord {
  amount: number;
  id: string;
  payment_id: string | null;
  status: string;
}

interface ProviderEvent {
  event_type: string;
  livemode: boolean;
  payment_attempt_id: string | null;
  processed_at: string | null;
  status: string;
}

/** A refund changes an attempt's status, but does not erase its payment history. */
export function summarizeVerifiedTestPayments(payments: PaymentRecord[], events: ProviderEvent[]) {
  const verifiedIds = new Set(events.filter((event) => event.event_type === "checkout_session.payment.paid"
    && event.status === "processed"
    && event.livemode === false && Boolean(event.processed_at)).map((event) => event.payment_attempt_id));
  return payments.reduce((summary, payment) => {
    if (!payment.payment_id || !verifiedIds.has(payment.id)) return summary;
    if (["paid", "late_paid", "refunded"].includes(payment.status)) {
      summary.collected += payment.amount;
      if (payment.status === "refunded") summary.refunded += payment.amount;
      else summary.refundable += payment.amount;
    }
    return summary;
  }, { collected: 0, refunded: 0, refundable: 0 });
}
