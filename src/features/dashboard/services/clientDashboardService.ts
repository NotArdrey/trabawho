import { fetchClientDashboardSnapshot } from "@/features/bookings/services/bookingService";
import { getActiveReplacementSchedules } from "@/features/bookings/services/replacementSchedules";
import type { DashboardSnapshot } from "../domain/dashboardModel";

export async function fetchClientOverviewSnapshot(): Promise<DashboardSnapshot> {
  const snapshot = await fetchClientDashboardSnapshot() as DashboardSnapshot;
  const bookingIds = snapshot.bookings.map((booking) => String(booking.id || "")).filter(Boolean);
  if (!bookingIds.length) return snapshot;

  const replacements = await getActiveReplacementSchedules(bookingIds);
  return {
    ...snapshot,
    bookings: snapshot.bookings.map((booking) => {
      const replacement = replacements.get(String(booking.id));
      return replacement && ["accepted", "delivered"].includes(replacement.status)
        ? { ...booking, activeReplacementStartAt: replacement.startAt, activeReplacementAcceptedAt: replacement.acceptedAt || undefined }
        : booking;
    }),
  };
}
