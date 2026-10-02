import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase";

export function subscribeToBookingActivity(onChange: () => void) {
  if (!isSupabaseConfigured) return () => {};
  let channel = supabase.channel(`booking-activity-${crypto.randomUUID()}`);
  for (const table of ["bookings", "conversations", "messages", "reviews", "booking_quotes", "booking_reschedule_requests", "payment_attempts", "booking_support_cases", "services", "service_slots"]) {
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  }
  channel.subscribe((status) => { if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) onChange(); });
  return () => { void supabase.removeChannel(channel); };
}
