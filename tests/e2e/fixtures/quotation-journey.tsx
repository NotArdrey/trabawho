import { useState } from "react";
import { createRoot } from "react-dom/client";

import { Button } from "@/components/ui/button";
import { BookingQuoteCard } from "@/features/bookings/components/BookingQuoteCard";
import { ProviderQuoteComposer, type QuoteProposalInput } from "@/features/bookings/components/ProviderQuoteComposer";
import { QuoteResponseDialog, type QuoteResponseAction } from "@/features/bookings/components/QuoteResponseDialog";
import type { BookingQuote } from "@/features/bookings/types/booking-transactions";
import "@/styles/globals.css";

function Journey() {
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [response, setResponse] = useState<QuoteResponseAction | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [closed, setClosed] = useState(false);
  const send = (input: QuoteProposalInput) => {
    setQuote((current) => ({ id: `quote-${(current?.version || 0) + 1}`, booking_id: "booking-1",
      version: (current?.version || 0) + 1, amount: input.amount, currency: "PHP",
      scope_summary: input.scopeSummary, proposed_start_ts: input.startAt, proposed_end_ts: input.endAt,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), response_note: null, status: "proposed" }));
    return Promise.resolve();
  };
  const reply = (action: QuoteResponseAction, feedback: string) => {
    setQuote((current) => current ? { ...current, status: action === "decline" ? "declined" : "changes_requested", response_note: feedback || null } : current);
    if (action === "decline") setClosed(true);
    return Promise.resolve();
  };
  return <main className="mx-auto grid max-w-3xl gap-4 p-4">
    {!closed ? <ProviderQuoteComposer onSubmit={send} /> : null}
    {quote ? <BookingQuoteCard quote={quote} canRespond={!closed} isConfirmed={confirmed} holdExpiresAt={quote.status === "accepted" ? "2099-10-07T00:00:00Z" : null}
      onAccept={() => setQuote((current) => current ? { ...current, status: "accepted" } : current)}
      onRequestChanges={() => setResponse("request_changes")}
      onDecline={() => setResponse("decline")} /> : null}
    {quote?.status === "accepted" ? <Button type="button" onClick={() => setConfirmed(true)}>Simulate verified payment</Button> : null}
    {closed ? <p role="status">Request closed</p> : null}
    <QuoteResponseDialog action={response} onClose={() => setResponse(null)} onSubmit={reply} />
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Journey />);
