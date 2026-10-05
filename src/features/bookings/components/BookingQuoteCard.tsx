import { CalendarClock, CheckCircle2, PhilippinePeso, Pencil, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateBookingPricing } from "@/features/bookings/utils/bookingPricing";
import type { BookingQuote } from "@/features/bookings/types/booking-transactions";
import { useQuoteClock } from "@/features/bookings/hooks/useQuoteClock";

interface BookingQuoteCardProps {
  canRespond: boolean;
  feeRate?: number;
  holdExpiresAt?: string | null;
  isConfirmed?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onRequestChanges?: () => void;
  quote: BookingQuote;
}

const money = (value: number) => `PHP ${Number(value).toLocaleString("en-PH", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;
const dateTime = (value: string) => new Intl.DateTimeFormat("en-PH", {
  dateStyle: "full", timeStyle: "short", timeZone: "Asia/Manila",
}).format(new Date(value));

export function BookingQuoteCard({ canRespond, feeRate, holdExpiresAt, isConfirmed = false, onAccept, onDecline, onRequestChanges, quote }: BookingQuoteCardProps) {
  const now = useQuoteClock();
  const holdActive = Boolean(holdExpiresAt && new Date(holdExpiresAt).getTime() > now);
  const expiryTime = new Date(quote.expires_at).getTime();
  const expired = !isConfirmed && (!Number.isFinite(expiryTime) || expiryTime <= now)
    && (quote.status === "proposed" || (quote.status === "accepted" && !holdActive));
  const active = quote.status === "proposed" && !expired;
  const pricing = calculateBookingPricing(quote.amount, feeRate);
  const status = isConfirmed ? "Visit confirmed" : expired ? "Expired" : ({
    proposed: "Awaiting client",
    accepted: holdActive ? "Payment pending" : "Payment not completed",
    rejected: "Changes requested",
    changes_requested: "Changes requested",
    declined: "Declined",
    superseded: "Replaced by new offer",
    expired: "Expired",
  } as const)[quote.status];
  const tone = isConfirmed ? "success" : active ? "brand" : quote.status === "accepted" ? "warning" : "secondary";

  return <Card className="mx-4 mb-4 overflow-hidden shadow-none" aria-labelledby={`quote-${quote.id}-title`}>
    <CardHeader className="flex flex-row flex-wrap items-center gap-3 border-b bg-primary/5 p-4 space-y-0">
      <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><PhilippinePeso className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><CardTitle id={`quote-${quote.id}-title`} className="text-base">Provider quote</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Offer {quote.version} · Price and schedule together</p></div>
      <Badge variant={tone}>{status}</Badge>
    </CardHeader>
    <CardContent className="grid gap-4 p-4">
      <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between gap-4"><span>Service price</span><strong>{money(quote.amount)}</strong></div>
        <div className="flex justify-between gap-4 text-muted-foreground"><span>Estimated platform fee ({pricing.transactionFeePercent})</span><span>{money(pricing.transactionFeeAmount)}</span></div>
        <div className="flex justify-between gap-4 border-t pt-2 font-bold"><span>Estimated total</span><span>{money(pricing.totalChargedAmount)}</span></div>
      </div>
      <div><p className="text-xs font-semibold text-muted-foreground">Included work</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{quote.scope_summary}</p></div>
      <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm"><CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div><p className="font-semibold">Proposed visit (Philippine time)</p><p className="mt-1">{dateTime(quote.proposed_start_ts)} – {dateTime(quote.proposed_end_ts)}</p></div></div>
      {active ? <p className="text-xs text-muted-foreground">Accept by {dateTime(quote.expires_at)}. This time is not held until checkout begins. Final fees and your payment choice appear before payment.</p> : null}
      {quote.response_note && quote.status === "changes_requested" ? <p className="rounded-md bg-muted p-3 text-sm"><strong>Client requested:</strong> {quote.response_note}</p> : null}
      {expired ? <p className="text-sm text-muted-foreground">This offer can no longer be used. Ask the provider for a new price and time.</p> : null}
      {canRespond && active ? <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button type="button" variant="outline" onClick={onDecline}><XCircle aria-hidden="true" />Decline quote</Button>
        <Button type="button" variant="outline" onClick={onRequestChanges}><Pencil aria-hidden="true" />Request changes</Button>
        <Button type="button" onClick={onAccept}><CheckCircle2 aria-hidden="true" />Accept and continue to payment</Button>
      </div> : null}
    </CardContent>
  </Card>;
}
