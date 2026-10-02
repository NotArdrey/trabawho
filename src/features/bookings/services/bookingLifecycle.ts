import {
  confirmBookingCompletion,
  fetchBookingById,
  markBookingDelivered,
} from "@/features/bookings/services/bookingService";

export type BookingLifecycleAction = "deliver" | "complete";

export interface BookingLifecycleRecord {
  id: string;
  scheduleVersion?: number;
  deliveryStatus?: string;
  raw?: { booking?: { schedule_version?: number; status?: string } };
}

export function lifecycleOperationId(action: BookingLifecycleAction, booking: BookingLifecycleRecord): string {
  const version = booking.scheduleVersion ?? booking.raw?.booking?.schedule_version ?? 1;
  return `booking-${action}-${booking.id}-schedule-${version}`;
}

export async function performBookingLifecycleAction(
  action: BookingLifecycleAction,
  bookingId: string,
): Promise<BookingLifecycleRecord> {
  const current = await fetchBookingById(bookingId) as BookingLifecycleRecord | null;
  if (!current?.id) throw new Error("This booking is no longer available. Refresh your bookings and try again.");

  const options = { idempotencyKey: lifecycleOperationId(action, current) };
  if (action === "deliver") await markBookingDelivered(bookingId, options);
  else await confirmBookingCompletion(bookingId, options);

  const refreshed = await fetchBookingById(bookingId) as BookingLifecycleRecord | null;
  if (!refreshed?.id) throw new Error("The update may have succeeded. Refresh your bookings to confirm its status.");
  return refreshed;
}
