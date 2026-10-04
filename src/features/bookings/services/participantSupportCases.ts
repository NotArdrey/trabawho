import { supabase } from "@/integrations/supabase";
import type { Database } from "@/integrations/supabase/database.types";
import { fetchBookingById } from "./bookingService";
import { getActiveReplacementSchedules, type ActiveReplacementSchedule } from "./replacementSchedules";
import type { BookingActionRecord } from "../types/booking-action-record";

type CaseRow = Database["public"]["Tables"]["booking_support_cases"]["Row"];
type BookingLink = Pick<Database["public"]["Tables"]["bookings"]["Row"], "id" | "buyer_id" | "seller_id" | "service_id">;
export interface ParticipantSupportCase {
  report: CaseRow;
  serviceTitle: string;
  counterpartName: string;
  viewerRole: "client" | "provider";
  unreadCount: number;
  replacementSchedule?: ActiveReplacementSchedule;
}

export async function listParticipantSupportCases(): Promise<ParticipantSupportCase[]> {
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) throw new Error("Please sign in again to see your support cases.");
  const userId = auth.data.user.id;
  const bookings: BookingLink[] = [];
  // Explicit participant filtering also keeps the member view scoped for admins.
  for (let offset = 0; ; offset += 100) {
    const result = await supabase.from("bookings").select("id, buyer_id, seller_id, service_id")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order("id").range(offset, offset + 99);
    if (result.error) throw new Error("Your support cases could not be loaded. Try refreshing.");
    bookings.push(...result.data);
    if (result.data.length < 100) break;
  }
  const reports: CaseRow[] = [];
  for (let start = 0; start < bookings.length; start += 100) {
    const links = bookings.slice(start, start + 100);
    for (let offset = 0; ; offset += 100) {
      const result = await supabase.from("booking_support_cases").select("*")
        .in("booking_id", links.map((booking) => booking.id)).order("created_at", { ascending: false })
        .order("id").range(offset, offset + 99);
      if (result.error) throw new Error("Your support cases could not be loaded. Try refreshing.");
      reports.push(...result.data);
      if (result.data.length < 100) break;
    }
  }
  if (!reports.length) return [];
  const unreadResult = await supabase.from("booking_case_notifications").select("case_id")
    .in("case_id", reports.map((report) => report.id)).eq("recipient_id", userId).is("read_at", null);
  if (unreadResult.error && unreadResult.error.code !== "PGRST205") throw new Error("Your case alerts could not be loaded. Try refreshing.");
  const unreadByCase = new Map<string, number>();
  for (const notice of unreadResult.data || []) unreadByCase.set(notice.case_id, (unreadByCase.get(notice.case_id) || 0) + 1);
  const relevantBookings = bookings.filter((booking) => reports.some((report) => report.booking_id === booking.id));
  const acceptedReports = reports.filter((report) => report.resolution_status === "replacement_accepted");
  let replacementSchedules = new Map<string, ActiveReplacementSchedule>();
  if (acceptedReports.length) {
    try {
      replacementSchedules = await getActiveReplacementSchedules(acceptedReports.map((report) => report.booking_id));
    } catch {
      // Keep the case list available; its card asks the member to retry the missing schedule.
    }
  }
  const titles = new Map<number, string>();
  const names = new Map<string, string>();
  for (let start = 0; start < relevantBookings.length; start += 100) {
    const batch = relevantBookings.slice(start, start + 100);
    const [services, people] = await Promise.all([
      supabase.from("services").select("id, title").in("id", [...new Set(batch.map((booking) => booking.service_id))]),
      supabase.from("profiles").select("user_id, full_name").in("user_id", [...new Set(batch.flatMap((booking) => [booking.buyer_id, booking.seller_id]))]),
    ]);
    for (const service of services.data || []) titles.set(service.id, service.title);
    for (const person of people.data || []) if (person.full_name) names.set(person.user_id, person.full_name);
  }
  return reports.sort((a, b) => b.created_at.localeCompare(a.created_at)).flatMap((report) => {
    const booking = bookings.find((link) => link.id === report.booking_id);
    if (!booking) return [];
    const viewerRole = booking.buyer_id === userId ? "client" : "provider";
    const activeSchedule = replacementSchedules.get(report.booking_id);
    const replacementSchedule = activeSchedule?.caseId === report.id ? activeSchedule : undefined;
    return [{ report, viewerRole, unreadCount: unreadByCase.get(report.id) || 0, serviceTitle: titles.get(booking.service_id) || "Booked service",
      counterpartName: names.get(viewerRole === "client" ? booking.seller_id : booking.buyer_id) || (viewerRole === "client" ? "Provider" : "Client"),
      replacementSchedule,
    }];
  });
}

export async function getParticipantSupportBooking(bookingId: string): Promise<BookingActionRecord> {
  const booking: unknown = await fetchBookingById(bookingId);
  if (!booking || typeof booking !== "object" || !("id" in booking) || booking.id !== bookingId) {
    throw new Error("This booking could not be loaded. Refresh and try again.");
  }
  return booking as BookingActionRecord;
}

export async function getParticipantReportImage(path: string) {
  const { data, error } = await supabase.storage.from("booking-evidence").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error("The report image could not be opened. Try again.");
  return data.signedUrl;
}
