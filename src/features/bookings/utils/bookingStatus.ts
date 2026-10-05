export interface StoredBookingStatus {
  cancellation_status?: string | null;
  delivery_status?: string | null;
  dispute_status?: string | null;
  payment_status?: string | null;
  schedule_status?: string | null;
  status?: string | null;
}

export interface StoredBookingMetadata {
  payment_method?: string | null;
  ui_status?: string | null;
  uiStatus?: string | null;
  refund_status?: string | null;
  cash_confirmation_status?: string | null;
  quote_approved?: boolean;
}

export function uiStatusFromDb(booking: StoredBookingStatus = {}, metadata: StoredBookingMetadata = {}): string {
  // Visit state is primary. Payment settlement and support progress are separate.
  if (booking.status === "cancelled") {
    return metadata.payment_method === "after-service-cash" ? "Cancelled (Cash)" : "Cancelled";
  }
  if (booking.dispute_status === "open") return "Dispute Open";
  if (booking.cancellation_status === "requested") return "Cancellation Requested";
  if (booking.payment_status === "refund_pending") return "Refund Pending";
  if (booking.status === "completed") return "Completed Service";
  if (booking.status === "refunded") return "Refunded";
  if (booking.delivery_status === "seller_claimed") return "Service Delivered";
  if (booking.schedule_status === "expired") return "Reservation Expired";
  if (booking.schedule_status === "held") return "Payment Pending";
  if (["gcash-advance", "paymongo-card"].includes(metadata.payment_method || "")) {
    if (booking.payment_status === "paid") return "Payment Confirmed";
    if (booking.payment_status === "partially_paid") return "Downpayment Paid";
    return "Payment Pending";
  }
  if (metadata.ui_status) return metadata.ui_status;
  if (metadata.uiStatus) return metadata.uiStatus;
  if (["requested", "approved-awaiting-client-confirmation"].includes(metadata.refund_status || "")) return "Refund Processing";
  if (metadata.cash_confirmation_status === "pending-worker-review") return "Cash Verification Pending";
  if (metadata.cash_confirmation_status === "denied") return "Cash Verification Denied";
  switch (booking.status) {
    case "pending": return metadata.quote_approved ? "Awaiting Slot Selection" : "Negotiating";
    case "confirmed": return metadata.payment_method ? "Service Scheduled" : "Slot Selected - Payment Pending";
    case "in_progress": return "Active Service";
    default: return "Negotiating";
  }
}
