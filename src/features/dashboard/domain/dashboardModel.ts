export type DashboardMetricId = "active" | "upcoming" | "messages" | "actions";

interface DashboardRawBooking {
  created_at?: string;
  start_ts?: string;
  updated_at?: string;
}

export interface DashboardBooking {
  canRate?: boolean;
  id?: string | number;
  paymentProofSubmitted?: boolean;
  raw?: { booking?: DashboardRawBooking };
  requestDate?: string;
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
  provider: string;
  schedule: string;
  service: string;
  status: string;
}

export interface RecentUpdate {
  detail: string;
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

const terminalStatuses = new Set(["Completed Service", "Service Stopped", "Cancelled", "Cancelled (Cash)", "Refunded"]);
const scheduledStatuses = new Set(["Service Scheduled", "Payment Confirmed", "Payment Submitted", "Cash Verification Pending", "Cash Verification Denied", "Active Service"]);
const clientActionStatuses = new Set(["Awaiting Slot Selection", "Payment Pending", "Slot Selected - Payment Pending", "Cash Verification Denied"]);

function getBookingUpdatedAt(booking: DashboardBooking) {
  const raw = booking.raw?.booking || {};
  return raw.updated_at || raw.created_at || booking.requestDate || null;
}

function getBookingStartDate(booking: DashboardBooking) {
  const rawStart = booking.raw?.booking?.start_ts || booking.startTs;
  if (rawStart) {
    const parsed = new Date(rawStart);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const selectedDate = booking.selectedSlot?.date || booking.selectedSlot?.dateKey;
  const startTime = booking.selectedSlot?.timeBlock?.startTime;
  if (!selectedDate) return null;
  const parsed = new Date(`${selectedDate}T${startTime || "00:00"}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDayLabel(date: Date | null) {
  if (!date) return "Coordinated through chat";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSchedule(booking: DashboardBooking) {
  const startDate = getBookingStartDate(booking);
  if (!startDate) return "Coordinated through chat";
  const time = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${formatDayLabel(startDate)}, ${time}`;
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

export function buildDashboardModel(data: DashboardSnapshot, isLoading: boolean) {
  const bookings = data.bookings || [];
  const messages = data.messages || [];
  const now = new Date();
  const bookingById = Object.fromEntries(bookings.map((booking) => [String(booking.id), booking]));
  const conversationById = Object.fromEntries((data.conversations || []).map((conversation) => [String(conversation.id), conversation]));
  const activeBookings = bookings.filter((booking) => !terminalStatuses.has(booking.status || ""));
  const awaitingReplyCount = activeBookings.filter((booking) => ["Negotiating", "Awaiting Slot Selection", "Payment Pending", "Slot Selected - Payment Pending"].includes(booking.status || "")).length;
  const upcomingBookings: UpcomingBooking[] = bookings
    .map((booking) => ({ booking, startDate: getBookingStartDate(booking) }))
    .filter(({ booking, startDate }) => !terminalStatuses.has(booking.status || "") && (scheduledStatuses.has(booking.status || "") || Boolean(startDate)) && (!startDate || startDate.getTime() >= now.getTime() - 86400000))
    .sort((a, b) => !a.startDate ? 1 : !b.startDate ? -1 : a.startDate.getTime() - b.startDate.getTime())
    .slice(0, 3)
    .map(({ booking }) => ({ service: booking.serviceType || "Service", provider: booking.workerName || "Provider", schedule: formatSchedule(booking), status: booking.status || "Pending" }));
  const actionNeededCount = bookings.filter((booking) => clientActionStatuses.has(booking.status || "") || Boolean(booking.canRate)).length;
  const loadingBookings = isLoading && bookings.length === 0;
  const metrics: DashboardMetric[] = [
    { id: "active", label: "Active bookings", value: loadingBookings ? "..." : String(activeBookings.length), detail: loadingBookings ? "Loading bookings" : `${awaitingReplyCount} awaiting provider reply` },
    { id: "upcoming", label: "Upcoming bookings", value: loadingBookings ? "..." : String(upcomingBookings.length), detail: loadingBookings ? "Loading schedule" : upcomingBookings[0] ? `Next service ${upcomingBookings[0].schedule.toLowerCase()}` : "No scheduled services" },
    { id: "messages", label: "Unread messages", value: isLoading && messages.length === 0 ? "..." : String(data.unreadMessageCount || 0), detail: isLoading && messages.length === 0 ? "Loading chats" : data.unreadMessageCount ? "Across active chats" : "No unread messages" },
    { id: "actions", label: "Action needed", value: loadingBookings ? "..." : String(actionNeededCount), detail: loadingBookings ? "Checking bookings" : actionNeededCount ? "Review booking updates" : "You're all caught up" },
  ];
  const messageUpdates = messages.map((message) => {
    const conversation = conversationById[String(message.conversation_id)];
    const booking = bookingById[String(conversation?.booking_id)];
    const fromCurrentUser = data.user?.id && String(message.sender_id) === String(data.user.id);
    return { id: `message-${String(message.id)}`, title: fromCurrentUser ? "Message sent" : "Provider message received", detail: `${booking?.serviceType || "Booking"} · ${getMessagePreview(message)}`, time: formatTimeAgo(message.created_at), sortDate: message.created_at };
  });
  const bookingUpdates = bookings.map((booking) => ({
    id: `booking-${String(booking.id)}`,
    title: booking.status === "Refund Processing" ? "Refund request updated" : booking.paymentProofSubmitted ? "Payment proof received" : booking.canRate ? "Review window open" : "Booking updated",
    detail: `${booking.serviceType || "Service"} · ${booking.status || "Updated"}`,
    time: formatTimeAgo(getBookingUpdatedAt(booking)),
    sortDate: getBookingUpdatedAt(booking),
  }));
  const recentUpdates: RecentUpdate[] = [...messageUpdates, ...bookingUpdates]
    .sort((a, b) => new Date(b.sortDate || 0).getTime() - new Date(a.sortDate || 0).getTime())
    .slice(0, 3)
    .map(({ id, title, detail, time }) => ({ id, title, detail, time }));
  return { metrics, upcomingBookings, recentUpdates };
}
