import { BookingQuoteSummary } from "@/features/bookings/components/BookingQuoteSummary";
import { ReservationStatus } from "@/features/bookings/components/ReservationStatus";
import type { BookingQuote } from "@/features/bookings/types/booking-transactions";

interface BookingReservationNoticeProps {
  canCheckoutQuote: boolean;
  expiresAt?: string | null;
  isSeller: boolean;
  onChooseSlot: () => void;
  onOpenChat: () => void;
  onRetryQuote: () => void;
  quote?: BookingQuote | null;
  scheduleHasPassed: boolean;
  scheduleStatus?: string | null;
}

export function BookingReservationNotice({ canCheckoutQuote, expiresAt, isSeller, onChooseSlot, onOpenChat,
  onRetryQuote, quote, scheduleHasPassed, scheduleStatus }: BookingReservationNoticeProps) {
  const next = quote ? canCheckoutQuote ? onRetryQuote : onOpenChat : onChooseSlot;
  return <>
    <ReservationStatus scheduleStatus={scheduleHasPassed ? "passed" : scheduleStatus} expiresAt={expiresAt}
      actionLabel={quote ? canCheckoutQuote ? "Retry saved quote" : "Open chat for new quote" : undefined}
      expiredDescription={quote ? canCheckoutQuote
        ? "The payment reservation ended. You can retry while this quote is valid and the time is free."
        : "This offer can no longer be used. Ask the provider to send a new price and time." : undefined}
      onChooseAnotherTime={isSeller ? undefined : next} />
    {quote ? <BookingQuoteSummary quote={quote} holdExpiresAt={expiresAt} viewerRole={isSeller ? "seller" : "buyer"}
      isConfirmed={scheduleStatus === "confirmed"} onOpen={onOpenChat} /> : null}
  </>;
}
