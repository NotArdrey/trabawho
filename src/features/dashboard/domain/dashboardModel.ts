import { isBookingTerminal } from "@/features/bookings/utils/bookingFilters";
import { buildClientBookingActions } from "@/features/dashboard/domain/clientNextSteps";
import { parsePhilippineSlot, philippineDayKey } from "@/shared/lib/philippineDateTime";

export type DashboardMetricId = "active" | "upcoming" | "messages" | "actions";

interface DashboardRawBooking {
  created_at?: string;
  start_ts?: string;
  updated_at?: string;
}

export interface DashboardBooking {
  activeReplacementAcceptedAt?: string;
  activeReplacementStartAt?: string;
  canRate?: boolean;
  cashCollectionStatus?: string;
  deliveryStatus?: string;
  id?: string | number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentProofSubmitted?: boolean;
  raw?: { booking?: DashboardRawBooking };
  requestDate?: string;
  refundSimulated?: boolean;
  selectedSlot?: {
    date?: string;
    dateKey?: string;
    timeBlock?: { startTime?: string };
  };
  serviceType?: string;
  startTs?: string;
  status?: string;
  workerName?: string;
}

interface DashboardConversation {
  booking_id?: string | number;
  id?: string | number;
}

interface DashboardMessage {
  attachments?: { type?: string };
  body?: string;
  content?: string;
  conversation_id?: string | number;
  created_at?: string;
  id?: string | number;
  message_type?: string;
  sender_id?: string | number;
}

export interface DashboardSnapshot {
  bookings: DashboardBooking[];
  conversations: DashboardConversation[];
  messages: DashboardMessage[];
  unreadMessageCount: number;
  user: { id?: string | number } | null;
}

export interface DashboardMetric {
  detail: string;
  id: DashboardMetricId;
  label: string;
  value: string;
}

export interface UpcomingBooking {
  id: string | number | null;
  isReplacement: boolean;
  provider: string;
  schedule: string;
  service: string;
  status: string;
}

export interface RecentUpdate {
  category: "message" | "visit" | "payment" | "refund" | "support" | "cancelled" | "general";
  detail: string;
  href?: string;
  id: string;
  time: string;
  title: string;
}

export const emptyDashboardData: DashboardSnapshot = {
  user: null,
  bookings: [],
  conversations: [],
  messages: [],
  unreadMessageCount: 0,
};

const filterableBooking = (booking: DashboardBooking) => ({ ...booking, status: booking.status || "" });

function getBookingUpdatedAt(booking: DashboardBooking) {
  const raw = booking.raw?.booking || {};
  return booking.activeReplacementAcceptedAt || raw.updated_at || raw.created_at || booking.requestDate || null;
}

function getBookingStartDate(booking: DashboardBooking) {
  if (booking.activeReplacementStartAt) {
    const replacement = new Date(booking.activeReplacementStartAt);
    return Number.isNaN(replacement.getTime()) ? null : replacement;
  }
  const rawStart = booking.raw?.booking?.start_ts || booking.startTs;
  if (rawStart) {
    const parsed = new Date(rawStart);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const selectedDate = booking.selectedSlot?.date || booking.selectedSlot?.dateKey;
  const startTime = booking.selectedSlot?.timeBlock?.startTime;
  if (!selectedDate) return null;
  return parsePhilippineSlot(selectedDate, startTime);
}

function formatDayLabel(date: Date, now: Date) {
  const diffDays = Math.round((Date.parse(`${philippineDayKey(date)}T00:00:00Z`) - Date.parse(`${philippineDayKey(now)}T00:00:00Z`)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
}

function formatSchedule(date: Date, now: Date) {
  const time = date.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
  return `${formatDayLabel(date, now)}, ${time}`;
}

function formatTimeAgo(value?: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMessagePreview(message: DashboardMessage) {
  if (message.attachments?.type === "quote" || message.message_type === "quote") return "Quote sent in chat";
  return String(message.body ?? message.content ?? "").trim() || "New message in chat";
}

function bookingUpdateTitle(booking: DashboardBooking) {
  if (booking.refundSimulated) return "Test refund recorded";
  if (booking.paymentStatus === "refund_pending") return "Refund review in progress";
  if (booking.paymentStatus === "refunded") return "Refund result recorded";
  if (["Cancelled", "Cancelled (Cash)"].includes(booking.status || "")) return "Booking cancelled";
  if (booking.status === "Dispute Open") return booking.activeReplacementStartAt && getBookingStartDate(booking) ? "Replacement visit confirmed" : "Support case open";
  if (booking.status === "Refund Processing") return "Refund review in progress";
  if (booking.status === "Refund Pending") return "Refund review in progress";
  if (booking.status === "Completed Service") return "Service completed";
  if (booking.canRate) return "Review window open";
  if (booking.status === "Payment Confirmed") return "Payment confirmed";
  if (booking.status === "Reservation Expired") return "Choose a new time";
  if (booking.status === "Service Delivered") return "Service marked delivered";
  if (["Payment Submitted", "Cash Verification Pending"].includes(booking.status || "")) return "Payment submitted for review";
  return "Booking updated";
}

function bookingUpdateDetail(booking: DashboardBooking, now: Date) {
  if (booking.refundSimulated) return `${booking.serviceType || "Service"} · No real money returned`;
  const replacement = booking.activeReplacementStartAt ? getBookingStartDate(booking) : null;
  return `${booking.serviceType || "Service"} · ${replacement ? `New visit ${formatSchedule(replacement, now)} PHT` : booking.status || "Updated"}`;
}

function bookingUpdateCategory(booking: DashboardBooking): RecentUpdate["category"] {
  if (booking.refundSimulated || ["refunded", "refund_pending"].includes(booking.paymentStatus || "") || ["Refund Processing", "Refund Pending"].includes(booking.status || "")) return "refund";
  if (["Cancelled", "Cancelled (Cash)"].includes(booking.status || "")) return "cancelled";
  if (booking.status === "Dispute Open") return booking.activeReplacementStartAt ? "visit" : "support";
  if (["Payment Confirmed", "Payment Submitted", "Cash Verification Pending"].includes(booking.status || "")) return "payment";
  if (["Reservation Expired", "Service Delivered", "Completed Service"].includes(booking.status || "")) return "visit";
  return "general";
}

export function buildDashboardModel(data: DashboardSnapshot, isLoading: boolean, now = new Date()) {
  const bookings = data.bookings || [];
  const messages = data.messages || [];
  const bookingById = Object.fromEntries(bookings.map((booking) => [String(booking.id), booking]));
  const conversationById = Object.fromEntries((data.conversations || []).map((conversation) => [String(conversation.id), conversation]));
  const activeBookings = bookings.filter((booking) => !isBookingTerminal(filterableBooking(booking)));
  const upcoming = bookings
    .map((booking) => ({ booking, startDate: getBookingStartDate(booking) }))
    .filter((entry): entry is { booking: DashboardBooking; startDate: Date } => !isBookingTerminal(filterableBooking(entry.booking)) && (entry.booking.status !== "Dispute Open" || Boolean(entry.booking.activeReplacementStartAt)) && Boolean(entry.startDate) && entry.startDate!.getTime() >= now.getTime())
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const upcomingBookings: UpcomingBooking[] = upcoming
    .slice(0, 3)
    .map(({ booking, startDate }) => ({ id: booking.id ?? null, service: booking.serviceType || "Service", provider: booking.workerName || "Provider", schedule: formatSchedule(startDate, now), status: booking.status || "Pending", isReplacement: Boolean(booking.activeReplacementStartAt) }));
  const actionNeededCount = buildClientBookingActions(bookings).length;
  const loadingBookings = isLoading && bookings.length === 0;
  const metrics: DashboardMetric[] = [
    { id: "active", label: "Active bookings", value: loadingBookings ? "..." : String(activeBookings.length), detail: loadingBookings ? "Loading bookings" : "Requests and visits in progress" },
    { id: "upcoming", label: "Upcoming visits", value: loadingBookings ? "..." : String(upcoming.length), detail: loadingBookings ? "Loading schedule" : upcomingBookings[0] ? `Next visit ${upcomingBookings[0].schedule} PHT` : "No upcoming visits" },
    { id: "messages", label: "Unread messages", value: isLoading && messages.length === 0 ? "..." : String(data.unreadMessageCount || 0), detail: isLoading && messages.length === 0 ? "Loading chats" : data.unreadMessageCount ? "Across active chats" : "No unread messages" },
    { id: "actions", label: "Action needed", value: loadingBookings ? "..." : String(actionNeededCount), detail: loadingBookings ? "Checking bookings" : actionNeededCount ? "Review booking updates" : "You're all caught up" },
  ];
  const messageUpdates = messages.map((message) => {
    const conversation = conversationById[String(message.conversation_id)];
    const booking = bookingById[String(conversation?.booking_id)];
    const fromCurrentUser = data.user?.id && String(message.sender_id) === String(data.user.id);
    return { id: `message-${String(message.id)}`, category: "message" as const, title: fromCurrentUser ? "Message sent" : "Provider message received", detail: `${booking?.serviceType || "Booking"} · ${getMessagePreview(message)}`, time: formatTimeAgo(message.created_at), sortDate: message.created_at,
      href: conversation?.booking_id ? `/messages/${encodeURIComponent(String(conversation.booking_id))}?scope=purchases&focus=conversation` : undefined };
  });
  const bookingUpdates = bookings.map((booking) => ({
    id: `booking-${String(booking.id)}`,
    category: bookingUpdateCategory(booking),
    title: bookingUpdateTitle(booking),
    detail: bookingUpdateDetail(booking, now),
    href: booking.id != null ? `/bookings?scope=purchases&filter=all&q=${encodeURIComponent(String(booking.id))}&focus=${encodeURIComponent(String(booking.id))}` : undefined,
    time: formatTimeAgo(getBookingUpdatedAt(booking)),
    sortDate: getBookingUpdatedAt(booking),
  }));
  const recentUpdates: RecentUpdate[] = [...messageUpdates, ...bookingUpdates]
    .sort((a, b) => new Date(b.sortDate || 0).getTime() - new Date(a.sortDate || 0).getTime())
    .slice(0, 3)
    .map(({ id, category, title, detail, time, href }) => ({ id, category, title, detail, time, href }));
  return { metrics, upcomingBookings, upcomingCount: upcoming.length, recentUpdates };
}
