export interface BookingFunding {
  paymentStatus?: string;
  balanceDueAmount?: number | string | null;
  amountPaid?: number | string | null;
  totalChargedAmount?: number | string | null;
}

export function isBookingFullyFunded(booking: BookingFunding): boolean {
  if (booking.paymentStatus !== "paid") return false;
  if (booking.balanceDueAmount != null && (!Number.isFinite(Number(booking.balanceDueAmount)) || Number(booking.balanceDueAmount) > 0)) return false;
  if (booking.totalChargedAmount != null) {
    return Number.isFinite(Number(booking.totalChargedAmount)) && Number(booking.totalChargedAmount) > 0
      && booking.amountPaid != null && Number.isFinite(Number(booking.amountPaid))
      && Number(booking.amountPaid) >= Number(booking.totalChargedAmount);
  }
  return true;
}
