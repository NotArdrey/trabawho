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
  const { data, error } = await supabase
    .from("service_slots")
    .select("id, service_id, start_ts, end_ts, capacity, metadata")
    .eq("service_id", Number(serviceId))
    .eq("status", "available")
    .eq("visibility", "public")
    .gte("start_ts", new Date().toISOString())
    .order("start_ts", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((slot) => {
    const metadata = slot.metadata && typeof slot.metadata === "object" && !Array.isArray(slot.metadata)
      ? slot.metadata
      : {};
    return {
      booked_count: Number(metadata.booked_count || 0),
      capacity: Number(slot.capacity || 1),
      end_ts: slot.end_ts,
      id: slot.id,
      service_id: slot.service_id,
      start_ts: slot.start_ts,
    };
  });
}
