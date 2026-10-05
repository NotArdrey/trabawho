export interface ProviderCalendarBooking {
  id: string;
  sellerId?: string | null;
  serviceType?: string | null;
  clientName?: string | null;
  status?: string | null;
  scheduleStatus?: string | null;
  holdExpiresAt?: string | null;
  appointmentStartAt?: string | null;
  raw?: { booking?: {
    status?: string | null;
    schedule_status?: string | null;
    start_ts?: string | null;
    end_ts?: string | null;
    hold_expires_at?: string | null;
  } | null } | null;
}

export interface ProviderBookingConflict {
  bookingId: string;
  serviceType: string;
  clientName: string;
  startAt: string;
}

export interface ProviderReplacementWindow {
  status: string;
  startAt: string;
  endAt: string;
}

interface ReservedWindow {
  start: number;
  end: number;
  startAt: string;
}

function reservedWindow(booking: ProviderCalendarBooking, now: number): ReservedWindow | null {
  const row = booking.raw?.booking;
  const status = row?.status;
  if (!status || ["cancelled", "refunded", "completed"].includes(status)) return null;
  const scheduleStatus = row.schedule_status ?? booking.scheduleStatus;
  if (scheduleStatus === "held") {
    const expiresAt = Date.parse(row.hold_expires_at ?? booking.holdExpiresAt ?? "");
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  } else if (scheduleStatus !== "confirmed" && scheduleStatus !== "reschedule_requested") return null;

  const startAt = row.start_ts ?? booking.appointmentStartAt;
  const endAt = row.end_ts;
  if (!startAt || !endAt) return null;
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end, startAt };
}

function replacementWindow(booking: ProviderCalendarBooking, replacement?: ProviderReplacementWindow): ReservedWindow | null {
  const status = booking.raw?.booking?.status;
  if (!status || ["cancelled", "refunded"].includes(status) || !replacement
    || !["accepted", "delivered"].includes(replacement.status)) return null;
  const start = Date.parse(replacement.startAt);
  const end = Date.parse(replacement.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end, startAt: replacement.startAt };
}

/** Mirrors the booking-window portion of the server's provider_time_conflicts rule. */
export function findProviderBookingConflicts(
  booking: ProviderCalendarBooking,
  providerBookings: readonly ProviderCalendarBooking[],
  now = Date.now(),
  replacementSchedules: ReadonlyMap<string, ProviderReplacementWindow> = new Map(),
): ProviderBookingConflict[] {
  if (!booking.sellerId) return [];
  const window = reservedWindow(booking, now);
  if (!window) return [];

  return providerBookings.flatMap((other) => {
    if (other.id === booking.id || other.sellerId !== booking.sellerId) return [];
    const windows = [reservedWindow(other, now), replacementWindow(other, replacementSchedules.get(other.id))];
    const otherWindow = windows.find((candidate) => candidate && window.start < candidate.end && candidate.start < window.end);
    if (!otherWindow) return [];
    return [{ bookingId: other.id, serviceType: other.serviceType || "Another service",
      clientName: other.clientName || "Another client", startAt: otherWindow.startAt }];
  });
}
