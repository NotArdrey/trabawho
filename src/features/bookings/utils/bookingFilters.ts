export interface FilterableBooking {
  status: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  refundStatus?: string | null;
  deliveryStatus?: string | null;
  cashConfirmationStatus?: string | null;
}

const COMPLETED = ["Completed Service", "Service Stopped"];
const CANCELLED = ["Cancelled", "Cancelled (Cash)"];
const TERMINAL = [...COMPLETED, ...CANCELLED, "Refunded"];
const PAYMENT_DUE = ["Payment Pending", "Slot Selected - Payment Pending", "Downpayment Paid"];

export function isBookingPaymentDue(booking: FilterableBooking) {
  if (TERMINAL.includes(booking.status) || booking.status === "Refund Processing" || booking.paymentStatus === "paid" || booking.paymentMethod === "after-service-cash") return false;
  return PAYMENT_DUE.includes(booking.status) || booking.paymentStatus === "partially_paid";
}

export function isBookingActionNeeded(booking: FilterableBooking, scope: string) {
  if (TERMINAL.includes(booking.status)) return false;
  if (scope === "incoming") {
    return ["Negotiating", "Cash Verification Pending", "Refund Processing"].includes(booking.status)
      || booking.paymentStatus === "pending_provider";
  }
  return booking.status === "Awaiting Slot Selection" || isBookingPaymentDue(booking)
    || booking.deliveryStatus === "seller_claimed" || booking.status === "Service Delivered";
}

export function matchesBookingHubFilter(booking: FilterableBooking, filter: string, scope: string) {
  if (filter === "all") return true;
  if (filter === "completed") return COMPLETED.includes(booking.status);
  if (filter === "cancelled") return CANCELLED.includes(booking.status);
  if (filter === "refunds") return Boolean(booking.refundStatus) || ["refund_pending", "refunded"].includes(booking.paymentStatus || "")
    || ["Refund Processing", "Refunded"].includes(booking.status);
  if (filter === "delivered") return !TERMINAL.includes(booking.status) && (booking.deliveryStatus === "seller_claimed" || booking.status === "Service Delivered");
  if (filter === "scheduled") return ["Payment Confirmed", "Service Scheduled", "Active Service"].includes(booking.status);
  if (filter === "payment-due") return isBookingPaymentDue(booking);
  if (filter === "action-needed") return isBookingActionNeeded(booking, scope);
  if (filter === "active") return !TERMINAL.includes(booking.status);
  return false;
}

export function matchesBookingDisplayFilter(booking: FilterableBooking, filter: string) {
  if (filter === "cash-approvals") return !TERMINAL.includes(booking.status)
    && booking.paymentMethod === "after-service-cash"
    && (booking.status === "Cash Verification Pending" || booking.cashConfirmationStatus === "pending-worker-review" || booking.paymentStatus === "pending_provider");
  if (filter === "payment-pending") return isBookingPaymentDue(booking);
  if (filter === "paid") return booking.paymentStatus === "paid";
  return matchesBookingHubFilter(booking, filter, "incoming");
}
