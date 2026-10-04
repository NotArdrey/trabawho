import { supabase } from "@/integrations/supabase";

export interface AvailableServiceSlot {
  booked_count: number;
  capacity: number;
  end_ts: string;
  id: number;
  service_id: number;
  start_ts: string;
}

export async function fetchPublicServiceSlots(serviceId: number | string) {
  const { data, error } = await supabase.rpc("list_available_service_slots", { p_service_ids: [Number(serviceId)] });

  if (error) throw error;
  return (data ?? []).map((slot) => {
    return {
      booked_count: 0,
      capacity: 1,
      end_ts: slot.end_ts,
      id: slot.id,
      service_id: slot.service_id,
      start_ts: slot.start_ts,
    };
  });
}
