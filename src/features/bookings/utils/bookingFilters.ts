export interface FilterableBooking {
  status: string;
  activeReplacementStartAt?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  refundStatus?: string | null;
  refundSimulated?: boolean;
  deliveryStatus?: string | null;
  cashConfirmationStatus?: string | null;
  cashCollectionStatus?: string | null;
  canRate?: boolean;
}

const COMPLETED = ["Completed Service", "Service Stopped"];
const CANCELLED = ["Cancelled", "Cancelled (Cash)"];
const TERMINAL = [...COMPLETED, ...CANCELLED, "Refunded", "Refund Simulated"];
const PAYMENT_DUE = ["Payment Pending", "Slot Selected - Payment Pending", "Downpayment Paid"];
const INQUIRY_STATUSES = new Set(["pending", "pending response", "negotiating", "awaiting slot selection"]);

export function isBookingInquiry(booking: FilterableBooking) {
  return !isBookingTerminal(booking) && INQUIRY_STATUSES.has(booking.status.trim().toLowerCase());
}

export function isBookingTerminal(booking: FilterableBooking) {
  return TERMINAL.includes(booking.status) || booking.refundSimulated === true || booking.paymentStatus === "refunded";
}

export function isBookingPaymentDue(booking: FilterableBooking) {
  if (isBookingTerminal(booking) || booking.status === "Refund Processing" || booking.paymentStatus === "paid" || booking.paymentMethod === "after-service-cash") return false;
  return PAYMENT_DUE.includes(booking.status) || booking.paymentStatus === "partially_paid";
}

export function isBookingActionNeeded(booking: FilterableBooking, scope: string) {
  if (booking.refundSimulated || booking.paymentStatus === "refunded") return false;
  if (scope !== "incoming" && booking.canRate && COMPLETED.includes(booking.status)) return true;
  if (isBookingTerminal(booking)) return false;
  if (scope === "incoming") {
    return ["Negotiating", "Cash Verification Pending", "Refund Processing"].includes(booking.status)
      || booking.paymentStatus === "pending_provider";
  }
  return ["Awaiting Slot Selection", "Cash Verification Denied", "Reservation Expired"].includes(booking.status) || isBookingPaymentDue(booking)
    || booking.deliveryStatus === "seller_claimed" || booking.cashCollectionStatus === "seller_claimed" || booking.status === "Service Delivered";
}

export function matchesBookingHubFilter(booking: FilterableBooking, filter: string, scope: string) {
  if (filter === "all") return true;
  if (filter === "completed") return COMPLETED.includes(booking.status);
  if (filter === "cancelled") return CANCELLED.includes(booking.status);
  if (filter === "refunds") return booking.refundSimulated === true || Boolean(booking.refundStatus)
    || ["refund_pending", "refunded"].includes(booking.paymentStatus || "")
    || ["Refund Processing", "Refunded", "Refund Simulated"].includes(booking.status);
  if (filter === "delivered") return !isBookingTerminal(booking) && (booking.deliveryStatus === "seller_claimed" || booking.status === "Service Delivered");
  if (filter === "inquiries") return scope === "incoming" && isBookingInquiry(booking);
  if (filter === "scheduled") return !isBookingTerminal(booking) && (Boolean(booking.activeReplacementStartAt)
    || ["Payment Confirmed", "Service Scheduled", "Active Service"].includes(booking.status));
  if (filter === "payment-due") return isBookingPaymentDue(booking);
  if (filter === "action-needed") return isBookingActionNeeded(booking, scope);
  if (filter === "active") return !isBookingTerminal(booking);
  return false;
}

export function matchesBookingDisplayFilter(booking: FilterableBooking, filter: string) {
  if (filter === "cash-approvals") return !isBookingTerminal(booking)
    && booking.paymentMethod === "after-service-cash"
    && (booking.status === "Cash Verification Pending" || booking.cashConfirmationStatus === "pending-worker-review" || booking.paymentStatus === "pending_provider");
  if (filter === "payment-pending") return isBookingPaymentDue(booking);
  if (filter === "paid") return booking.paymentStatus === "paid" && !booking.refundSimulated
    && !["Refunded", "Refund Simulated"].includes(booking.status);
  return matchesBookingHubFilter(booking, filter, "incoming");
}
