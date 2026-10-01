import { CalendarClock, CheckCircle2, PhilippinePeso, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BookingQuote } from "@/features/bookings/types/booking-transactions";

interface BookingQuoteCardProps {
  canRespond: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  quote: BookingQuote;
}

const formatPhp = (amount: number) => `PHP ${Number(amount).toLocaleString("en-PH", {
  minimumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
})}`;

const formatSchedule = (startValue: string, endValue: string) => {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const date = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(start);
  const time = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time.format(start)}–${time.format(end)}`;
};

export function BookingQuoteCard({ canRespond, onAccept, onReject, quote }: BookingQuoteCardProps) {
  return (
    <section className="mx-4 mb-4 overflow-hidden rounded-xl bg-muted/45" aria-labelledby={`quote-${quote.id}-title`}>
      <header className="flex items-center gap-3 bg-primary/10 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-background text-primary"><PhilippinePeso className="size-5" aria-hidden="true" /></span>
        <div>
          <h3 id={`quote-${quote.id}-title`} className="font-bold text-foreground">Provider quote</h3>
          <p className="text-xs text-muted-foreground">Version {quote.version} · Review price and schedule together</p>
        </div>
      </header>
      <div className="grid gap-4 p-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Service price</p>
          <p className="mt-1 text-2xl font-extrabold text-foreground">{formatPhp(quote.amount)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Included work</p>
          <p className="mt-1 text-sm leading-6 text-foreground">{quote.scope_summary}</p>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-background p-3 text-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div><p className="font-semibold text-foreground">Proposed schedule</p><p className="mt-1 text-muted-foreground">{formatSchedule(quote.proposed_start_ts, quote.proposed_end_ts)}</p></div>
        </div>
        {canRespond ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onReject}><XCircle aria-hidden="true" />Request changes</Button>
            <Button type="button" onClick={onAccept}><CheckCircle2 aria-hidden="true" />Review and reserve</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
