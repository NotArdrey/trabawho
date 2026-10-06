import { getWorkPaymentBlockReason, isBookingFullyFunded } from "@/features/bookings/utils/bookingPaymentGuard";
import type { BookingActionRecord } from "@/features/bookings/types/booking-action-record";

export interface StartWorkAvailability {
  visible: boolean;
  enabled: boolean;
  reason: string;
}

export function getStartWorkAvailability(
  booking: BookingActionRecord,
  viewerRole: "client" | "provider",
  now: number,
): StartWorkAvailability {
  const visible = viewerRole === "provider"
    && booking.raw?.booking?.status === "confirmed"
    && booking.deliveryStatus === "not_delivered"
    && !booking.workStartedAt;
  if (!visible) return { visible: false, enabled: false, reason: "" };

  if (booking.cancellationStatus && booking.cancellationStatus !== "none") {
    return { visible, enabled: false, reason: booking.cancellationStatus === "requested"
      ? "A cancellation request is under review. Work cannot start yet."
      : "This booking's cancellation state prevents work from starting. Contact support if the request was declined." };
  }
  if (booking.disputeStatus === "open") {
    return { visible, enabled: false, reason: "Work is paused while the support case is open." };
  }
  if (["refund_pending", "refunded"].includes(booking.paymentStatus || "")) {
    return { visible, enabled: false, reason: "This payment is in a refund process. Work cannot start." };
  }
  if (!isBookingFullyFunded(booking)) {
    return { visible, enabled: false, reason: getWorkPaymentBlockReason(booking) };
  }
  if (booking.scheduleStatus !== "confirmed") {
    return { visible, enabled: false, reason: "The appointment is not confirmed yet." };
  }

  const startAt = booking.appointmentStartAt ? Date.parse(booking.appointmentStartAt) : NaN;
  if (!Number.isFinite(startAt)) {
    return { visible, enabled: false, reason: "The appointment time is unavailable. Refresh this booking before starting work." };
  }
  const availableAt = startAt - 30 * 60_000;
  if (now < availableAt) {
    const localTime = new Date(availableAt).toLocaleString("en-PH", {
      timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
    });
    return { visible, enabled: false, reason: `Start work becomes available ${localTime} PHT, 30 minutes before the appointment.` };
  }

  return { visible, enabled: true, reason: "" };
}
