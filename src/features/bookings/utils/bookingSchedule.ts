interface BookingScheduleInput {
  activeQuote?: { proposed_start_ts?: string | null } | null;
  paymentStatus?: string | null;
  raw?: { booking?: { start_ts?: string | null } | null } | null;
  selectedSlot?: {
    date?: string | null;
    rawSlot?: { start_ts?: string | null } | null;
    timeBlock?: {
      startTime?: string | null;
      rawSlot?: { start_ts?: string | null } | null;
    } | null;
  } | null;
}

const parseScheduleStart = (booking: BookingScheduleInput) => {
  const directStart = booking.raw?.booking?.start_ts
    ?? booking.selectedSlot?.rawSlot?.start_ts
    ?? booking.selectedSlot?.timeBlock?.rawSlot?.start_ts
    ?? booking.activeQuote?.proposed_start_ts;
  if (directStart) {
    const timestamp = new Date(directStart).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const date = booking.selectedSlot?.date;
  const time = booking.selectedSlot?.timeBlock?.startTime;
  if (!date || !time) return null;
  const timestamp = new Date(`${date} ${time}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const hasPastUnpaidSchedule = (booking: BookingScheduleInput, now = Date.now()) => {
  if (["paid", "partially_paid", "refund_pending", "refunded"].includes(String(booking.paymentStatus))) return false;
  const scheduleStart = parseScheduleStart(booking);
  return scheduleStart !== null && scheduleStart <= now;
};
