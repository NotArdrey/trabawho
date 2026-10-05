import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import ChatWindow from "@/features/bookings/components/ChatWindow";
import type { QuoteProposalInput } from "@/features/bookings/components/ProviderQuoteComposer";
import "@/styles/globals.css";
import "@/shared/styles/modern.css";

function Journey() {
  const isStandalone = new URLSearchParams(window.location.search).has("standalone");
  const shouldRerender = new URLSearchParams(window.location.search).has("rerender");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!shouldRerender) return;
    const timer = window.setInterval(() => setTick((current) => current + 1), 100);
    return () => window.clearInterval(timer);
  }, [shouldRerender]);
  const [booking, setBooking] = useState({
    id: isStandalone ? "conversation:7b0b479a-4c4e-4dac-b061-dd3cc520bb35" : "booking-1",
    bookingMode: isStandalone ? "conversation" : "calendar-only", isStandaloneChat: isStandalone,
    isRequestBooking: true,
    workerName: "Sofia Provider", clientName: "Ana Client", serviceType: "Garden Cleanup",
    status: "Negotiating", scheduleStatus: "unscheduled", paymentStatus: "unpaid",
    quoteAmount: 0, quoteApproved: false, raw: { booking: { status: "pending" } },
    activeQuote: null as null | {
      id: string; amount: number; version: number; status: "proposed"; scope_summary: string;
      proposed_start_ts: string; proposed_end_ts: string; expires_at: string;
    },
  });

  const sendQuote = (input: QuoteProposalInput): Promise<void> => {
    setBooking((current) => ({ ...current, quoteAmount: input.amount, status: "Quote Ready",
      activeQuote: { id: "quote-1", amount: input.amount, version: 1, status: "proposed",
        scope_summary: input.scopeSummary, proposed_start_ts: input.startAt,
        proposed_end_ts: input.endAt, expires_at: "2099-10-07T00:00:00Z" } }));
    return Promise.resolve();
  };
  const bookings = new URLSearchParams(window.location.search).has("many")
    ? [booking, ...Array.from({ length: 9 }, (_, index) => ({
      ...booking, id: `booking-${index + 2}`, clientName: `Client ${index + 2}`,
    }))]
    : [booking];

  return <main className="booking-chat-page" data-render-tick={tick}>
    <ChatWindow booking={booking} bookings={bookings} viewerRole="seller" selectedBookingId={booking.id}
      onSelectBooking={() => undefined} onProposeQuote={sendQuote} />
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<BrowserRouter><Journey /></BrowserRouter>);
