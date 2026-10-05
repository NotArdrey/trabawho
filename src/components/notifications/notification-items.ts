import { paths } from "@/app/router/routes";
import type { Database, Json } from "@/integrations/supabase";
import type { AppNotification } from "./notification-center";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type CaseNoticeRow = Database["public"]["Tables"]["booking_case_notifications"]["Row"];
type CaseMessageRow = Database["public"]["Tables"]["booking_case_messages"]["Row"];
type QuoteRow = Database["public"]["Tables"]["booking_quotes"]["Row"];

function formatRelativeTime(value: string) {
  const difference = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(difference / 60_000);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(difference / 3_600_000);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(difference / 86_400_000), "day");
}

function hasReadBy(readBy: Json | null, userId: string) {
  const matchesUser = (value: Json | undefined) => (typeof value === "string" || typeof value === "number") && String(value) === userId;
  if (Array.isArray(readBy)) return readBy.some(matchesUser);
  if (typeof readBy === "string") {
    try { return hasReadBy(JSON.parse(readBy) as Json, userId); }
    catch { return readBy === userId; }
  }
  if (readBy && typeof readBy === "object") return Object.values(readBy).some(matchesUser);
  return false;
}

function readableStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function bookingNotification(row: BookingRow, userId: string, readIds: Set<string>): AppNotification {
  const id = `booking:${row.id}:${row.updated_at}`;
  const status = readableStatus(row.status || "updated");
  const isClient = row.buyer_id === userId;
  const route = isClient ? paths.bookings : paths.workerBookings;
  const scope = isClient ? "purchases" : "incoming";
  return {
    id, title: `Booking ${status}`, message: `Booking ${row.id.slice(0, 8)} is now ${status.toLowerCase()}.`,
    time: formatRelativeTime(row.updated_at), createdAt: row.updated_at, isRead: readIds.has(id), type: "booking",
    href: `${route}?scope=${scope}&q=${encodeURIComponent(row.id)}`,
  };
}

export function messageNotification(row: MessageRow, conversation: ConversationRow, userId: string, readIds: Set<string>): AppNotification {
  const id = `message:${row.id}`;
  const body = row.body?.trim();
  const scope = conversation.buyer_id === userId ? "purchases" : "incoming";
  return {
    id, title: "New message",
    message: body ? (body.length > 90 ? `${body.slice(0, 87)}...` : body) : "You received a new attachment.",
    time: formatRelativeTime(row.created_at), createdAt: row.created_at,
    isRead: readIds.has(id) || hasReadBy(row.read_by, userId), type: "message",
    href: `${paths.messages}/${encodeURIComponent(conversation.booking_id || conversation.id)}?scope=${scope}`,
  };
}

export function quoteNotification(row: QuoteRow, booking: BookingRow, userId: string, readIds: Set<string>): AppNotification | null {
  const isClient = booking.buyer_id === userId;
  if ((row.status === "proposed" && !isClient) ||
      (["changes_requested", "declined", "accepted"].includes(row.status) && isClient) ||
      !["proposed", "changes_requested", "declined", "accepted", "expired"].includes(row.status)) return null;
  const id = `quote:${row.id}:${row.status}`;
  const labels: Record<string, [string, string]> = {
    proposed: ["New provider quote", "Review the proposed price and appointment."],
    changes_requested: ["Quote changes requested", "The client asked you to revise your offer."],
    declined: ["Quote declined", "The client declined the offer and closed the request."],
    accepted: ["Quote accepted", "The client started checkout for your offer."],
    expired: ["Quote expired", "This offer can no longer be accepted."],
  };
  const [title, message] = labels[row.status];
  return { id, title, message, time: formatRelativeTime(row.updated_at), createdAt: row.updated_at,
    isRead: readIds.has(id), type: "quote",
    href: `${paths.messages}/${encodeURIComponent(row.booking_id)}?scope=${isClient ? "purchases" : "incoming"}` };
}

export function caseNotification(notice: CaseNoticeRow, message: CaseMessageRow | undefined): AppNotification {
  const body = message?.body?.trim();
  return {
    id: `case:${notice.id}`, caseId: notice.case_id,
    title: message?.author_role === "admin" ? "Support update" : "Support case update",
    message: body ? (body.length > 90 ? `${body.slice(0, 87)}...` : body) : "Open your support case to see the latest update.",
    time: formatRelativeTime(notice.created_at), createdAt: notice.created_at,
    isRead: Boolean(notice.read_at), type: "case",
    href: `${paths.supportCases}?case=${encodeURIComponent(notice.case_id)}#case-conversation`,
  };
}
