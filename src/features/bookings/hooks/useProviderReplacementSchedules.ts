import { useCallback, useEffect, useMemo, useState } from "react";

import { useBookingActivity } from "@/features/bookings/hooks/useBookingActivity";
import { getActiveReplacementSchedules } from "@/features/bookings/services/replacementSchedules";
import type { ProviderCalendarBooking, ProviderReplacementWindow } from "@/features/bookings/utils/providerBookingConflicts";

interface Snapshot {
  idsKey: string;
  schedules: ReadonlyMap<string, ProviderReplacementWindow>;
}

const emptySchedules = new Map<string, ProviderReplacementWindow>();

export function useProviderReplacementSchedules(bookings: readonly ProviderCalendarBooking[], enabled: boolean) {
  const idsKey = enabled ? bookings.map((booking) => booking.id).sort().join(",") : "";
  const ids = useMemo(() => idsKey ? idsKey.split(",") : [], [idsKey]);
  const [snapshot, setSnapshot] = useState<Snapshot>({ idsKey: "", schedules: emptySchedules });
  const refresh = useCallback(async () => {
    if (ids.length === 0) return;
    try {
      const schedules = await getActiveReplacementSchedules(ids);
      setSnapshot({ idsKey, schedules });
    } catch {
      // Keep booking-window warnings available; the server still validates replacement visits.
    }
  }, [ids, idsKey]);

  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  useBookingActivity(refresh, enabled && ids.length > 0, 30_000, "support");
  return snapshot.idsKey === idsKey ? snapshot.schedules : emptySchedules;
}
