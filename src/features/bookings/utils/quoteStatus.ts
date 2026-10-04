import type { BookingQuote } from "@/features/bookings/types/booking-transactions";

interface QuotedBooking {
  activeQuote?: BookingQuote | null;
  holdExpiresAt?: string | null;
  paymentStatus?: string;
  scheduleStatus?: string;
}

export function isQuoteCheckoutAvailable(booking: QuotedBooking, now = Date.now()): boolean {
  const quote = booking.activeQuote;
  if (!quote || booking.paymentStatus === "partially_paid") return true;
  if (quote.status !== "proposed" && quote.status !== "accepted") return false;
  if (new Date(quote.proposed_start_ts).getTime() <= now) return false;
  if (new Date(quote.expires_at).getTime() > now) return true;
  return quote.status === "accepted" && booking.scheduleStatus === "held"
    && Boolean(booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() > now);
}
