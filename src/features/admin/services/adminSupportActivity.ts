import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase";

export function subscribeToAdminSupportActivity(onChange: () => void) {
  if (!isSupabaseConfigured) return () => {};
  let channel = supabase.channel(`admin-support-${crypto.randomUUID()}`);
  for (const table of ["booking_support_cases", "booking_support_admin_actions", "booking_case_actions", "booking_refunds"]) {
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  }
  channel.subscribe((status) => { if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) onChange(); });
  return () => { void supabase.removeChannel(channel); };
}
