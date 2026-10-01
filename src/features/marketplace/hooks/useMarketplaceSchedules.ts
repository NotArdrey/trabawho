import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase";
import { buildWeeklyScheduleFromSlots } from "@/features/marketplace/utils/serviceNormalizer";
import type { createScheduleForProvider } from "@/features/marketplace/utils/serviceNormalizer";

interface MarketplaceProvider {
  id: number | string;
  rawService?: { id?: number | string };
  [key: string]: unknown;
}

type MarketplaceSchedule = ReturnType<typeof createScheduleForProvider>;

export function useMarketplaceSchedules(services: MarketplaceProvider[]) {
  const [schedules, setSchedules] = useState<Record<string, MarketplaceSchedule>>({});
  const [revision, setRevision] = useState(0);
  const refreshSchedules = useCallback(() => {
    setSchedules({});
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const serviceIds = services
      .map((provider) => Number(provider.rawService?.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (serviceIds.length === 0) return () => { active = false; };

    const load = async () => {
      const { data, error } = await supabase
        .from("service_slots")
        .select("id, service_id, seller_id, start_ts, end_ts, capacity, status, visibility, metadata")
        .in("service_id", serviceIds)
        .eq("status", "available")
        .eq("visibility", "public")
        .gte("start_ts", new Date().toISOString())
        .order("start_ts", { ascending: true });
      if (!active || error) return;

      const slotsByService = (data ?? []).reduce<Record<string, typeof data>>((result, slot) => {
        (result[String(slot.service_id)] ??= []).push(slot);
        return result;
      }, {});
      setSchedules(Object.fromEntries(services.map((provider) => [
        String(provider.id),
        buildWeeklyScheduleFromSlots(slotsByService[String(provider.rawService?.id)] ?? [], provider),
      ])));
    };
    void load();
    return () => { active = false; };
  }, [revision, services]);

  return { refreshSchedules, schedulesByProvider: schedules };
}
