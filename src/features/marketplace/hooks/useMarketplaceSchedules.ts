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
      const { data, error } = await supabase.rpc("list_available_service_slots", { p_service_ids: serviceIds });
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
