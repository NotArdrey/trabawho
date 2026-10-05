import { supabase } from "@/integrations/supabase";
import { isBookableClientAppointment } from "@/shared/domain/clientBookingDate";

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
  const unique = new Set<string>();
  return (data ?? []).filter((slot) => {
    if (!isBookableClientAppointment(slot.start_ts, slot.end_ts)) return false;
    const key = `${slot.service_id}:${slot.start_ts}:${slot.end_ts}`;
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  }).map((slot) => {
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
