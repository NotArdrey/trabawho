export interface CancellationBooking {
  buyerId?: string | null;
  sellerId?: string | null;
  cancellationRequestedBy?: string | null;
  cancellationStatus?: string | null;
  disputeStatus?: string | null;
  status: string;
  paymentStatus?: string | null;
}

const terminalStatuses = new Set(["Completed Service", "Cancelled", "Cancelled (Cash)", "Refunded"]);

export function canRequestBookingCancellation(booking: CancellationBooking, isProvider: boolean): boolean {
  if (terminalStatuses.has(booking.status) || booking.disputeStatus === "open"
    || booking.cancellationStatus === "requested") return false;
  // Providers may request cancellation of paid appointments; unpaid appointments
  // retain the existing client-owned immediate cancellation flow.
  return !isProvider || ["partially_paid", "paid"].includes(booking.paymentStatus || "");
}

export function canReviewBookingCancellation(booking: CancellationBooking, isProvider: boolean): boolean {
  const viewerId = isProvider ? booking.sellerId : booking.buyerId;
  return booking.cancellationStatus === "requested" && Boolean(viewerId)
    && Boolean(booking.cancellationRequestedBy)
    && viewerId !== booking.cancellationRequestedBy;
}

export function bookingRefundStage(booking: Pick<CancellationBooking, "status" | "paymentStatus"> & {
  refundSimulated?: boolean;
}): "review" | "simulated" | null {
  if (booking.status !== "Cancelled" && booking.status !== "Cancelled (Cash)") return null;
  if (booking.refundSimulated) return "simulated";
  return booking.paymentStatus === "refund_pending" ? "review" : null;
}
