import { supabase } from "@/integrations/supabase";

export async function deleteWorkService(serviceId: number, sellerId: string) {
  // Retain the service record referenced by bookings and conversation history.
  const { data: service, error: readError } = await supabase.from("services").select("metadata").eq("id", serviceId).eq("seller_id", sellerId).single();
  if (readError) throw new Error("Unable to load this service. Refresh My Work and try again.");
  const metadata = service.metadata && typeof service.metadata === "object" && !Array.isArray(service.metadata) ? service.metadata : {};
  const { data, error } = await supabase.from("services").update({ active: false, metadata: { ...metadata, deleted_from_work: true } }).eq("id", serviceId).eq("seller_id", sellerId).select("id").single();
  if (error || !data) throw new Error("Unable to delete this service. Check your connection and try again.");
}

export async function deleteWorkSlot(slotId: number, sellerId: string) {
  const { data, error } = await supabase.from("service_slots").delete().eq("id", slotId).eq("seller_id", sellerId).select("id").single();
  if (error || !data) throw new Error("Unable to delete this availability. It may be linked to a booking. Refresh and try again.");
}
