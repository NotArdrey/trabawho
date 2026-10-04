import { CalendarClock, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BookingQuote } from "@/features/bookings/types/booking-transactions";
import { useQuoteClock } from "@/features/bookings/hooks/useQuoteClock";

interface BookingQuoteSummaryProps {
  isConfirmed?: boolean;
  holdExpiresAt?: string | null;
  viewerRole?: "buyer" | "seller";
  onOpen: () => void;
  quote: BookingQuote;
}

export function BookingQuoteSummary({ holdExpiresAt, isConfirmed = false, viewerRole = "buyer", onOpen, quote }: BookingQuoteSummaryProps) {
  const now = useQuoteClock();
  const holdActive = Boolean(holdExpiresAt && new Date(holdExpiresAt).getTime() > now);
  const expiryTime = new Date(quote.expires_at).getTime();
  const expired = !isConfirmed && (!Number.isFinite(expiryTime) || expiryTime <= now)
    && (quote.status === "proposed" || (quote.status === "accepted" && !holdActive));
  const status = isConfirmed ? "Visit confirmed" : expired ? "Quote expired" : ({
    proposed: viewerRole === "buyer" ? "Awaiting your response" : "Awaiting client", accepted: holdActive ? "Payment pending" : "Payment not completed", rejected: "Changes requested",
    changes_requested: "Changes requested", declined: "Declined", superseded: "Offer replaced", expired: "Quote expired",
  } as const)[quote.status];
  const visit = new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(quote.proposed_start_ts));
  return <section className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Provider quote status">
    <div className="flex min-w-0 gap-3"><CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">Provider offer #{quote.version}</p><Badge variant={isConfirmed ? "success" : expired ? "warning" : "brand"}>{status}</Badge></div>
        <p className="mt-1 text-sm">{visit} PHT</p><p className="mt-1 text-xs text-muted-foreground">{isConfirmed ? "This is your confirmed appointment." : "The proposed time is not reserved until checkout starts."}</p></div></div>
    <Button type="button" variant="outline" onClick={onOpen}>View quote <ArrowRight aria-hidden="true" /></Button>
  </section>;
}
