import { supabase } from "@/integrations/supabase";
import { fetchSellerBookings } from "@/features/bookings/services/bookingService";
import { loadWorkerProfileServices } from "@/features/work/services/workerService";
import type {
  ConfirmedEarningsSummary,
  ProviderActionItem,
  ProviderDashboardMetric,
  ProviderDashboardSnapshot,
  ProviderScheduleItem,
} from "@/features/work/types/provider-dashboard";

type UnknownRecord = Record<string, unknown>;
const loadProviderServices = loadWorkerProfileServices as unknown as (input: { userId: string; fallbackProfile: unknown }) => Promise<unknown>;

const TERMINAL_STATUSES = new Set(["completed service", "service stopped", "cancelled", "cancelled (cash)", "refunded"]);
const INQUIRY_STATUSES = new Set(["pending", "pending response", "negotiating", "awaiting slot selection"]);

const asRecord = (value: unknown): UnknownRecord => value && typeof value === "object" ? value as UnknownRecord : {};
const text = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() || "";
const number = (...values: unknown[]) => {
  const value = values.find((item) => item !== null && item !== undefined && item !== "");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function bookingDate(booking: UnknownRecord) {
  const raw = asRecord(asRecord(booking.raw).booking);
  const selectedSlot = asRecord(booking.selectedSlot);
  const timeBlock = asRecord(selectedSlot.timeBlock);
  const timestamp = text(raw.start_ts, booking.startTs, selectedSlot.startTs);
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const date = text(selectedSlot.date, selectedSlot.dateKey);
  if (!date) return null;
  const startTime = text(timeBlock.startTime) || "00:00";
  const parsed = new Date(`${date}T${startTime}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatSchedule(date: Date | null) {
  if (!date) return "Schedule coordinated in chat";
  return date.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function currency(amount: number, code = "PHP") {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(amount);
}

function isReadByUser(value: unknown, userId: string) {
  if (Array.isArray(value)) return value.some((item) => String(item) === userId);
  if (typeof value === "string") {
    try { return isReadByUser(JSON.parse(value) as unknown, userId); } catch { return value === userId; }
  }
  if (value && typeof value === "object") return Object.values(value as UnknownRecord).some((item) => String(item) === userId);
  return false;
}

function confirmedEarnings(bookings: UnknownRecord[]): ConfirmedEarningsSummary {
  const confirmed = bookings.filter((booking) => {
    const status = text(booking.status).toLowerCase();
    const excluded = ["service stopped", "cancelled", "cancelled (cash)", "refunded"].includes(status) || status.includes("refund");
    const paid = text(booking.paymentStatus).toLowerCase() === "paid";
    const acknowledgedCash = text(booking.cashCollectionStatus).toLowerCase() === "buyer_acknowledged";
    return !excluded && (paid || acknowledgedCash);
  });
  return {
    amount: confirmed.reduce((sum, booking) => sum + number(booking.totalAmount, booking.quoteAmount, booking.expectedCashAmount), 0),
    currency: text(confirmed[0]?.currency) || "PHP",
    bookingCount: confirmed.length,
  };
}

function scheduleItem(booking: UnknownRecord): ProviderScheduleItem {
  const date = bookingDate(booking);
  return {
    id: text(booking.id),
    service: text(booking.serviceType) || "Service",
    client: text(booking.clientName) || "Client",
    schedule: formatSchedule(date),
    status: text(booking.status) || "Scheduled",
    bookingId: text(booking.id),
  };
}

function bookingAction(booking: UnknownRecord, now: Date): ProviderActionItem | null {
  const id = text(booking.id);
  const status = text(booking.status) || "Updated";
  const normalizedStatus = status.toLowerCase();
  const date = bookingDate(booking);
  const base = {
    id: `booking-${id}`,
    detail: `${text(booking.clientName) || "Client"} · ${text(booking.serviceType) || "Service"}`,
    status,
    schedule: date ? formatSchedule(date) : undefined,
    amount: number(booking.quoteAmount, booking.expectedCashAmount, booking.totalAmount) > 0
      ? currency(number(booking.quoteAmount, booking.expectedCashAmount, booking.totalAmount), text(booking.currency) || "PHP")
      : undefined,
    bookingId: id,
  };
  if (text(booking.cashConfirmationStatus) === "pending-worker-review") return { ...base, priority: 1, title: "Review payment confirmation", destination: "work" };
  if (text(booking.refundStatus) && !["completed", "approved"].includes(text(booking.refundStatus).toLowerCase())) return { ...base, priority: 1, title: "Review refund request", destination: "work" };
  if (INQUIRY_STATUSES.has(normalizedStatus)) return { ...base, priority: 2, title: "Respond to client request", destination: "work" };
  if (date && sameDay(date, now) && !TERMINAL_STATUSES.has(normalizedStatus)) return { ...base, priority: 4, title: "Job scheduled today", destination: "bookings" };
  if (!TERMINAL_STATUSES.has(normalizedStatus)) return { ...base, priority: 5, title: "Active booking update", destination: "bookings" };
  return null;
}

export async function fetchProviderDashboardSnapshot(userId: string, fallbackProfile: unknown): Promise<ProviderDashboardSnapshot> {
  const [bookingsValue, providerValue, conversationsResult, slotsResult] = await Promise.all([
    fetchSellerBookings(userId),
    loadProviderServices({ userId, fallbackProfile }),
    supabase.from("conversations").select("id,booking_id").eq("seller_id", userId).limit(100),
    supabase.from("service_slots").select("id,start_ts,status").eq("seller_id", userId).gte("start_ts", new Date().toISOString()).order("start_ts", { ascending: true }).limit(100),
  ]);
  if (conversationsResult.error) throw conversationsResult.error;
  if (slotsResult.error) throw slotsResult.error;

  const bookings = Array.isArray(bookingsValue) ? bookingsValue.map(asRecord) : [];
  const provider = asRecord(providerValue);
  const seller = asRecord(provider.sellerData);
  const profile = asRecord(fallbackProfile);
  const services = Array.isArray(provider.sellerDbServices) ? provider.sellerDbServices.map(asRecord) : [];
  const rating = asRecord(provider.sellerRatingAggregate);
  const conversations = conversationsResult.data || [];
  const conversationIds = conversations.map((row) => row.id);
  const bookingIdByConversation = new Map(conversations.map((row) => [row.id, row.booking_id]));
  const messagesResult = conversationIds.length
    ? await supabase.from("messages").select("*").in("conversation_id", conversationIds).neq("sender_id", userId).order("created_at", { ascending: false }).limit(40)
    : { data: [], error: null };
  if (messagesResult.error) throw messagesResult.error;

  const messages = (messagesResult.data || []).map(asRecord);
  const unreadMessages = messages.filter((message) => !isReadByUser(message.read_by, userId));
  const earnings = confirmedEarnings(bookings);
  const now = new Date();
  const activeBookings = bookings.filter((booking) => !TERMINAL_STATUSES.has(text(booking.status).toLowerCase()));
  const openInquiries = activeBookings.filter((booking) => INQUIRY_STATUSES.has(text(booking.status).toLowerCase()));
  const scheduled = activeBookings
    .filter((booking) => bookingDate(booking))
    .sort((left, right) => (bookingDate(left)?.getTime() || 0) - (bookingDate(right)?.getTime() || 0));
  const todaySchedule = scheduled.filter((booking) => sameDay(bookingDate(booking) as Date, now)).map(scheduleItem);
  const nextBooking = scheduled.find((booking) => (bookingDate(booking)?.getTime() || 0) >= now.getTime()) || null;

  const messageActions: ProviderActionItem[] = unreadMessages.map((message) => ({
    id: `message-${text(message.id)}`,
    priority: 3,
    title: "Unread client message",
    detail: text(message.body) || "A client sent an attachment.",
    bookingId: text(bookingIdByConversation.get(text(message.conversation_id))),
    destination: "messages",
  }));
  const actions = [...bookings.map((booking) => bookingAction(booking, now)).filter((item): item is ProviderActionItem => Boolean(item)), ...messageActions]
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 5);
  const verificationStatus = text(seller.verification_status) || (seller.is_verified === true ? "approved" : "") || null;
  const availableSlots = (slotsResult.data || []).filter((slot) => slot.status === "available").length;
  const metrics: ProviderDashboardMetric[] = [
    { id: "inquiries", label: "Open inquiries", value: String(openInquiries.length), detail: openInquiries.length ? "Waiting for your response" : "No requests waiting" },
    { id: "today", label: "Today's jobs", value: String(todaySchedule.length), detail: todaySchedule.length ? "Scheduled for today" : "Your day is clear" },
    { id: "messages", label: "Unread messages", value: String(unreadMessages.length), detail: unreadMessages.length ? "From active conversations" : "No unread messages" },
    { id: "earnings", label: "Confirmed earnings", value: currency(earnings.amount, earnings.currency), detail: `${earnings.bookingCount} confirmed payment${earnings.bookingCount === 1 ? "" : "s"}` },
  ];

  return {
    providerName: text(profile.firstName, profile.fullName, profile.full_name, seller.display_name) || "Provider",
    hasProviderSetup: Boolean(seller.user_id || services.length),
    metrics,
    actions,
    todaySchedule,
    nextAppointment: nextBooking ? scheduleItem(nextBooking) : null,
    serviceHealth: {
      totalListings: services.length,
      activeListings: services.filter((service) => service.active === true).length,
      availableSlots,
      rating: number(rating.avg_rating) || null,
      reviewCount: number(rating.rating_count),
      verificationStatus,
    },
    confirmedEarnings: earnings,
    conversationIds,
  };
}
