import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import ChatWindow from "@/features/bookings/components/ChatWindow";
import type { QuoteProposalInput } from "@/features/bookings/components/ProviderQuoteComposer";
import "@/styles/globals.css";
import "@/shared/styles/modern.css";

function Journey() {
  const [booking, setBooking] = useState({
    id: "booking-1", bookingMode: "calendar-only", isRequestBooking: true,
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

  return <main className="booking-chat-page">
    <ChatWindow booking={booking} bookings={[booking]} viewerRole="seller" selectedBookingId={booking.id}
      onSelectBooking={() => undefined} onProposeQuote={sendQuote} />
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<BrowserRouter><Journey /></BrowserRouter>);
