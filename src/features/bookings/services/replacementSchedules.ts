import { supabase } from "@/integrations/supabase";
import type { Database } from "@/integrations/supabase/database.types";

type Visit = Database["public"]["Tables"]["booking_case_replacement_visits"]["Row"];

export interface ActiveReplacementSchedule {
  acceptedAt?: string | null;
  bookingId: string;
  caseId: string;
  status: Visit["status"];
  startAt: string;
  endAt: string;
}

export async function getActiveReplacementSchedules(bookingIds: string[]): Promise<Map<string, ActiveReplacementSchedule>> {
  const ids = [...new Set(bookingIds.filter(Boolean))];
  const schedules = new Map<string, ActiveReplacementSchedule>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const visits = await supabase.from("booking_case_replacement_visits")
      .select("booking_id, case_id, slot_id, status, accepted_at")
      .in("booking_id", batch).in("status", ["accepted", "delivered", "completed"])
      .order("accepted_at", { ascending: false });
    if (visits.error) throw new Error("Replacement schedules could not be loaded. Try again.");
    if (!visits.data.length) continue;
    const slots = await supabase.from("service_slots").select("id, start_ts, end_ts")
      .in("id", [...new Set(visits.data.map((visit) => visit.slot_id))]);
    if (slots.error) throw new Error("Replacement times could not be loaded. Try again.");
    const slotsById = new Map(slots.data.map((slot) => [slot.id, slot]));
    for (const visit of visits.data) {
      if (schedules.has(visit.booking_id)) continue;
      const slot = slotsById.get(visit.slot_id);
      if (!slot) throw new Error("The confirmed replacement time is not visible to this account. Ask support to check access, then retry.");
      schedules.set(visit.booking_id, {
        acceptedAt: visit.accepted_at,
        bookingId: visit.booking_id, caseId: visit.case_id, status: visit.status,
        startAt: slot.start_ts, endAt: slot.end_ts,
      });
    }
  }
  return schedules;
}

export async function getActiveReplacementSchedule(bookingId: string) {
  return (await getActiveReplacementSchedules([bookingId])).get(bookingId) ?? null;
}
