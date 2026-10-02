import { useCallback, useEffect, useState } from "react";

import { useBookingActivity } from "@/features/bookings/activity";
import { fetchProviderDashboardSnapshot } from "@/features/work/services/providerDashboardService";
import type { ProviderDashboardSnapshot } from "@/features/work/types/provider-dashboard";

function useProviderDashboard(userId: string, fallbackProfile: unknown) {
  const [snapshot, setSnapshot] = useState<ProviderDashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    if (!userId) {
      setSnapshot(null);
      setIsLoading(false);
      return;
    }
    try {
      setError("");
      const next = await fetchProviderDashboardSnapshot(userId, fallbackProfile);
      setSnapshot(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load your provider dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [fallbackProfile, userId]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initialRefresh);
  }, [refresh]);

  useBookingActivity(refresh, Boolean(userId));

  return { snapshot, isLoading, error, refresh };
}

export { useProviderDashboard };
