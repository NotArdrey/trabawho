import { paths } from "@/app/router/routes";
import type { ProviderActionItem } from "@/features/work/types/provider-dashboard";

export function providerBookingPath(bookingId?: string) {
  const params = new URLSearchParams({ scope: "incoming", filter: "all" });
  if (bookingId) params.set("q", bookingId);
  return `${paths.workerBookings}?${params}`;
}

export function providerActionPath(action: ProviderActionItem) {
  if (action.destination === "bookings") return providerBookingPath(action.bookingId);
  if (action.destination === "work") {
    const params = new URLSearchParams();
    if (action.workSection) params.set("section", action.workSection);
    if (action.bookingId) params.set("booking", action.bookingId);
    return `${paths.work}${params.size ? `?${params}` : ""}`;
  }
  return null;
}
