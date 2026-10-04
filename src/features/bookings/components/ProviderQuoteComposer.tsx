import { useId, useRef, useState, type FormEvent } from "react";
import { CalendarClock, ChevronLeft, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuoteClock } from "@/features/bookings/hooks/useQuoteClock";

export interface QuoteProposalInput {
  amount: number;
  endAt: string;
  scopeSummary: string;
  startAt: string;
  operationId: string;
}

interface ProviderQuoteComposerProps {
  initialAmount?: string;
  onCancel?: () => void;
  onSubmit: (input: QuoteProposalInput) => Promise<void>;
}

const phDate = (value: string) => new Date(`${value}:00+08:00`);
const money = (value: number) => `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const schedule = (value: Date) => new Intl.DateTimeFormat("en-PH", {
  dateStyle: "full", timeStyle: "short", timeZone: "Asia/Manila",
}).format(value);

export function ProviderQuoteComposer({ initialAmount = "", onCancel, onSubmit }: ProviderQuoteComposerProps) {
  const id = useId();
  const [amount, setAmount] = useState(initialAmount);
  const [scopeSummary, setScopeSummary] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const operationId = useRef<string | null>(null);
  const now = useQuoteClock();

  const numericAmount = Number(amount);
  const start = phDate(startAt);
  const end = phDate(endAt);
  const validate = (now: number) => {
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !/^\d+(\.\d{1,2})?$/.test(amount))
      return "Enter a service price greater than zero, with at most two decimal places.";
    if (!scopeSummary.trim()) return "Describe the work this price includes.";
    if (!startAt || !endAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
      || start.getTime() <= now || end <= start)
      return "Choose a future start and an end after it (Philippine time).";
    return "";
  };

  const review = (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate(now);
    setError(validationError);
    if (!validationError) setIsReviewing(true);
  };

  const send = async () => {
    const validationError = validate(now);
    if (validationError) { setError(validationError); setIsReviewing(false); return; }
    try {
      setError("");
      setIsSaving(true);
      operationId.current ||= `quote:${crypto.randomUUID()}`;
      await onSubmit({ amount: numericAmount, scopeSummary: scopeSummary.trim(),
        startAt: start.toISOString(), endAt: end.toISOString(), operationId: operationId.current });
      setAmount(""); setScopeSummary(""); setStartAt(""); setEndAt("");
      setIsReviewing(false); operationId.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send this quote. Try again.");
    } finally { setIsSaving(false); }
  };

  return <Card className="mx-4 mb-4 border-primary/20 bg-primary/5">
    <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><CalendarClock className="size-5" aria-hidden="true" /></span>
      <div><CardTitle className="text-base">{isReviewing ? "Review your offer" : "Send price and schedule"}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">The client reviews this offer before choosing whether to reserve and pay. Sending it does not hold the time.</p></div>
    </CardHeader>
    <CardContent>
      {isReviewing ? <div className="grid gap-3" aria-live="polite">
        <dl className="grid gap-2 rounded-lg bg-background p-4 text-sm">
          <div><dt className="text-muted-foreground">Service price</dt><dd className="font-bold">{money(numericAmount)}</dd></div>
          <div><dt className="text-muted-foreground">Included work</dt><dd className="whitespace-pre-wrap">{scopeSummary.trim()}</dd></div>
          <div><dt className="text-muted-foreground">Starts (PHT)</dt><dd className="font-semibold">{schedule(start)}</dd></div>
          <div><dt className="text-muted-foreground">Ends (PHT)</dt><dd className="font-semibold">{schedule(end)}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">The offer expires after 24 hours or when the proposed visit starts, whichever comes first. The platform fee and payment choices appear at checkout.</p>
        {error ? <p id={`${id}-error`} role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setIsReviewing(false)} disabled={isSaving}><ChevronLeft aria-hidden="true" />Edit offer</Button>
          <Button type="button" onClick={() => { void send(); }} isLoading={isSaving}><Send aria-hidden="true" />Send quote</Button></div>
      </div> : <form onSubmit={review} className="grid gap-4" aria-label="Create a provider quote">
        <div className="grid gap-2"><Label htmlFor={`${id}-amount`}>Service price (PHP)</Label><Input id={`${id}-amount`} type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); operationId.current = null; }} placeholder="950.00" aria-describedby={error ? `${id}-error` : undefined} required /></div>
        <div className="grid gap-2"><Label htmlFor={`${id}-scope`}>Included work</Label><Textarea id={`${id}-scope`} value={scopeSummary} onChange={(event) => { setScopeSummary(event.target.value); operationId.current = null; }} maxLength={1000} rows={3} placeholder="Describe labor, materials, and important limits." aria-describedby={error ? `${id}-error` : undefined} required /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`${id}-start`}>Starts (PHT)</Label><Input id={`${id}-start`} type="datetime-local" value={startAt} onChange={(event) => { setStartAt(event.target.value); operationId.current = null; }} aria-describedby={error ? `${id}-error` : undefined} required /></div>
          <div className="grid gap-2"><Label htmlFor={`${id}-end`}>Ends (PHT)</Label><Input id={`${id}-end`} type="datetime-local" value={endAt} onChange={(event) => { setEndAt(event.target.value); operationId.current = null; }} aria-describedby={error ? `${id}-error` : undefined} required /></div></div>
        <p className="text-xs text-muted-foreground">Times are Philippine time. The provider’s calendar will be checked before this offer is saved and again if the client accepts.</p>
        {error ? <p id={`${id}-error`} role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">{onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Back to chat</Button> : null}<Button type="submit">Review quote</Button></div>
      </form>}
    </CardContent>
  </Card>;
}
