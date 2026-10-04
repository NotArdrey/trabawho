import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase";

export type BookingActivityScope = "booking" | "support";

const bookingTables = ["bookings", "conversations", "messages", "reviews", "booking_quotes", "booking_reschedule_requests", "payment_attempts", "booking_support_cases", "services", "service_slots"];
const supportTables = ["booking_support_cases", "booking_case_messages", "booking_case_notifications", "booking_case_replacement_visits", "booking_refunds"];

export function subscribeToBookingActivity(onChange: () => void, scope: BookingActivityScope = "booking") {
  if (!isSupabaseConfigured) return () => {};
  let channel = supabase.channel(`booking-activity-${crypto.randomUUID()}`);
  for (const table of scope === "support" ? supportTables : bookingTables) {
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  }
  channel.subscribe((status) => { if (scope === "booking" && status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) onChange(); });
  return () => { void supabase.removeChannel(channel); };
}
