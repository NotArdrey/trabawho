import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase";
import { fetchProviderDashboardSnapshot } from "@/features/work/services/providerDashboardService";
import type { ProviderDashboardSnapshot } from "@/features/work/types/provider-dashboard";

function useProviderDashboard(userId: string, fallbackProfile: unknown) {
  const [snapshot, setSnapshot] = useState<ProviderDashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshTimer = useRef<number | null>(null);

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

  useEffect(() => {
    if (!userId) return undefined;
    const scheduleRefresh = () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void refresh(), 180);
    };
    const channel = supabase
      .channel(`provider-dashboard-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `seller_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "services", filter: `seller_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_slots", filter: `seller_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `seller_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  return { snapshot, isLoading, error, refresh };
}

export { useProviderDashboard };
