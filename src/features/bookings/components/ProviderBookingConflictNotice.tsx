import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProviderBookingConflict } from "@/features/bookings/utils/providerBookingConflicts";

interface Props {
  conflicts: readonly ProviderBookingConflict[];
  onViewBooking: (bookingId: string) => void;
}

const visitTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
});

export function ProviderBookingConflictNotice({ conflicts, onViewBooking }: Props) {
  if (conflicts.length === 0) return null;

  return <div role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Schedule conflict with {conflicts.length} other {conflicts.length === 1 ? "booking" : "bookings"}</p>
        <p className="mt-1 text-sm">These jobs overlap for this provider, even if they are different services. Resolve the schedule before starting work.</p>
        <ul className="mt-3 space-y-2">
          {conflicts.map((conflict) => <li key={conflict.bookingId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="min-w-0 break-words">{conflict.serviceType} for {conflict.clientName} | {visitTime.format(new Date(conflict.startAt))} PHT</span>
            <Button type="button" variant="outline" size="sm" className="min-h-11 border-red-300 bg-white text-red-900 hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-100" onClick={() => onViewBooking(conflict.bookingId)}>
              View conflicting booking
            </Button>
          </li>)}
        </ul>
      </div>
    </div>
  </div>;
}
