import type { ProviderReplacementWindow } from "@/features/bookings/utils/providerBookingConflicts";
import { matchesBookingHubFilter, type FilterableBooking } from "@/features/bookings/utils/bookingFilters";
import { paginateBookings } from "@/features/bookings/utils/bookingPagination";
import { matchesBookingSearch, type SearchableBooking } from "@/features/bookings/utils/bookingSearch";

type HubBooking = FilterableBooking & SearchableBooking & { id: string };

export function buildBookingHubView<T extends HubBooking>(
  bookings: readonly T[],
  replacements: ReadonlyMap<string, ProviderReplacementWindow>,
  scope: string,
  filter: string,
  search: string,
  page: string | null,
  definitions: readonly (readonly [string, string])[],
) {
  const filterable = bookings.map((booking) => {
    const visit = replacements.get(booking.id);
    return visit && ["accepted", "delivered"].includes(visit.status)
      ? { ...booking, activeReplacementStartAt: visit.startAt }
      : booking;
  });
  const displayFilters = definitions.map(([value, label]) => ({
    value, label, count: filterable.filter((booking) => matchesBookingHubFilter(booking, value, scope)).length,
  }));
  const displayedBookings = filterable.filter((booking) => matchesBookingHubFilter(booking, filter, scope)
    && (!search.trim() || matchesBookingSearch(booking, search)));
  return { displayFilters, displayedBookings, bookingPage: paginateBookings(displayedBookings, page) };
}
