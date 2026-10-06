import { supabase } from "@/integrations/supabase";
import { fetchSellerBookings } from "@/features/bookings/services/bookingService";
import { isBookingInquiry, isBookingTerminal } from "@/features/bookings/utils/bookingFilters";
import { getActiveReplacementSchedules } from "@/features/bookings/services/replacementSchedules";
import { loadWorkerProfileServices } from "@/features/work/services/workerService";
import { formatPhilippineSchedule, parsePhilippineSlot, samePhilippineDay } from "@/shared/lib/philippineDateTime";
import type {
  ConfirmedEarningsSummary,
  ProviderActionItem,
  ProviderDashboardMetric,
  ProviderDashboardSnapshot,
  ProviderScheduleItem,
  ProviderServiceListing,
} from "@/features/work/types/provider-dashboard";

type UnknownRecord = Record<string, unknown>;
const loadProviderServices = loadWorkerProfileServices as unknown as (input: { userId: string; fallbackProfile: unknown }) => Promise<unknown>;

const asRecord = (value: unknown): UnknownRecord => value && typeof value === "object" ? value as UnknownRecord : {};
const text = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() || "";
const number = (...values: unknown[]) => {
  const value = values.find((item) => item !== null && item !== undefined && item !== "");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const requestBasedService = (service: UnknownRecord) => {
  const metadata = asRecord(service.metadata);
  return text(metadata.pricing_model, service.price_type).toLowerCase() === "inquiry"
    || text(service.price_type).toLowerCase() === "custom"
    || text(metadata.booking_mode).toLowerCase() === "calendar-only";
};
const terminalBooking = (booking: UnknownRecord) => isBookingTerminal({
  status: text(booking.status), paymentStatus: text(booking.paymentStatus), refundSimulated: booking.refundSimulated === true,
});

function bookingDate(booking: UnknownRecord) {
  const raw = asRecord(asRecord(booking.raw).booking);
  const selectedSlot = asRecord(booking.selectedSlot);
  const timeBlock = asRecord(selectedSlot.timeBlock);
  const replacementStart = text(booking.activeReplacementStartAt);
  if (replacementStart) {
    const replacement = new Date(replacementStart);
    return Number.isNaN(replacement.getTime()) ? null : replacement;
  }
  const timestamp = text(raw.start_ts, booking.startTs, selectedSlot.startTs);
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const date = text(selectedSlot.date, selectedSlot.dateKey);
  if (!date) return null;
  const startTime = text(timeBlock.startTime) || "00:00";
  return parsePhilippineSlot(date, startTime);
}

function formatSchedule(date: Date | null) {
  if (!date) return "Schedule coordinated in chat";
  return `${formatPhilippineSchedule(date)} PHT`;
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
    const excluded = terminalBooking(booking) || status === "dispute open" || status.includes("refund") || Boolean(text(booking.refundStatus));
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
    supportCaseOpen: text(booking.status).toLowerCase() === "dispute open" && Boolean(text(booking.activeReplacementStartAt)),
    service: text(booking.serviceType) || "Service",
    client: text(booking.clientName) || "Client",
    schedule: formatSchedule(date),
    status: text(booking.activeReplacementStartAt) ? "Replacement visit confirmed" : text(booking.status) || "Scheduled",
    bookingId: text(booking.id),
  };
}

function bookingAction(booking: UnknownRecord, now: Date): ProviderActionItem | null {
  if (terminalBooking(booking)) return null;
  const id = text(booking.id);
  const status = text(booking.status) || "Updated";
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
  if (text(booking.cashConfirmationStatus) === "pending-worker-review") return { ...base, priority: 1, title: "Review payment confirmation", destination: "work", workSection: "cash-approvals" };
  if (text(booking.refundStatus) && !["completed", "approved"].includes(text(booking.refundStatus).toLowerCase())) return { ...base, priority: 1, title: "Review refund request", destination: "work", workSection: "refunds" };
  if (isBookingInquiry({ status })) return { ...base, priority: 2, title: "Respond to client request", destination: "bookings" };
  if (date && samePhilippineDay(date, now) && (status.toLowerCase() !== "dispute open" || text(booking.activeReplacementStartAt))) return { ...base, priority: 4, title: "Visit scheduled today", status: text(booking.activeReplacementStartAt) ? "Replacement visit" : status, destination: "bookings" };
  return null;
}

export async function fetchProviderDashboardSnapshot(userId: string, fallbackProfile: unknown): Promise<ProviderDashboardSnapshot> {
  const [bookingsValue, providerValue, conversationsResult] = await Promise.all([
    fetchSellerBookings(userId),
    loadProviderServices({ userId, fallbackProfile }),
    supabase.from("conversations").select("id,booking_id").eq("seller_id", userId).limit(100),
  ]);
  if (conversationsResult.error) throw conversationsResult.error;

  const storedBookings = Array.isArray(bookingsValue) ? bookingsValue.map(asRecord) : [];
  const replacements = await getActiveReplacementSchedules(storedBookings.map((booking) => text(booking.id)));
  const bookings = storedBookings.map((booking) => {
    const replacement = replacements.get(text(booking.id));
    return replacement && ["accepted", "delivered"].includes(replacement.status)
      ? { ...booking, activeReplacementStartAt: replacement.startAt } : booking;
  });
  const provider = asRecord(providerValue);
  const seller = asRecord(provider.sellerData);
  const profile = asRecord(fallbackProfile);
  const services = Array.isArray(provider.sellerDbServices) ? provider.sellerDbServices.map(asRecord).filter((service) => asRecord(service.metadata).deleted_from_work !== true) : [];
  const activeServices = services.filter((service) => service.active === true);
  const serviceIds = activeServices.filter((service) => !requestBasedService(service))
    .map((service) => Number(service.id)).filter((id) => Number.isSafeInteger(id) && id > 0);
  const availabilityResult = serviceIds.length
    ? await supabase.rpc("list_available_service_slots", { p_service_ids: serviceIds })
    : { data: [], error: null };
  if (availabilityResult.error) throw availabilityResult.error;
  const availableSlots = availabilityResult.data || [];
  const slotsByService = new Map<number, typeof availableSlots>();
  for (const slot of availableSlots) {
    const group = slotsByService.get(slot.service_id) || [];
    group.push(slot);
    slotsByService.set(slot.service_id, group);
  }
  const serviceListings: ProviderServiceListing[] = activeServices.map((service) => {
    const requestBased = requestBasedService(service);
    const slots = slotsByService.get(Number(service.id)) || [];
    const nextSlot = slots.reduce<string | null>((earliest, slot) => !earliest || slot.start_ts < earliest ? slot.start_ts : earliest, null);
    return {
      id: Number(service.id),
      title: text(service.title) || "Untitled service",
      description: text(service.short_description, service.description),
      bookingType: requestBased ? "Request-based booking" : "Time-slot booking",
      availableSlots: slots.length,
      nextOpenAt: nextSlot ? `${formatPhilippineSchedule(new Date(nextSlot))} PHT` : null,
    };
  });
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
  const activeBookings = bookings.filter((booking) => !terminalBooking(booking));
  const openInquiries = activeBookings.filter((booking) => isBookingInquiry({ status: text(booking.status) }));
  const scheduled = activeBookings
    .filter((booking) => bookingDate(booking) && (text(booking.status).toLowerCase() !== "dispute open" || text(booking.activeReplacementStartAt)))
    .sort((left, right) => (bookingDate(left)?.getTime() || 0) - (bookingDate(right)?.getTime() || 0));
  const todaySchedule = scheduled.filter((booking) => samePhilippineDay(bookingDate(booking) as Date, now)).map(scheduleItem);
  const nextBooking = scheduled.find((booking) => (bookingDate(booking)?.getTime() || 0) >= now.getTime()) || null;

  const messageActions: ProviderActionItem[] = unreadMessages.map((message) => ({
    id: `message-${text(message.id)}`,
    priority: 3,
    title: "Unread client message",
    detail: text(message.body) || "A client sent an attachment.",
    bookingId: text(bookingIdByConversation.get(text(message.conversation_id))),
    conversationId: text(message.conversation_id),
    destination: "messages",
  }));
  const actions = [...bookings.map((booking) => bookingAction(booking, now)).filter((item): item is ProviderActionItem => Boolean(item)), ...messageActions]
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 5);
  const verificationStatus = text(seller.verification_status) || (seller.is_verified === true ? "approved" : "") || null;
  const metrics: ProviderDashboardMetric[] = [
    { id: "inquiries", label: "Open inquiries", value: String(openInquiries.length), detail: openInquiries.length ? "Waiting for your response" : "No requests waiting" },
    { id: "today", label: "Today's visits", value: String(todaySchedule.length), detail: todaySchedule.length ? "Scheduled for today" : "No visits today" },
    { id: "messages", label: "Unread messages", value: String(unreadMessages.length), detail: unreadMessages.length ? "From active conversations" : "No unread messages" },
    { id: "earnings", label: "Verified booking value", value: currency(earnings.amount, earnings.currency), detail: `${earnings.bookingCount} paid, undisputed booking${earnings.bookingCount === 1 ? "" : "s"}` },
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
      activeListings: activeServices.length,
      availableSlots: availableSlots.length,
      rating: number(rating.avg_rating) || null,
      reviewCount: number(rating.rating_count),
      verificationStatus,
    },
    serviceListings,
    confirmedEarnings: earnings,
    conversationIds,
  };
}
