import { useState, type FormEvent } from "react";
import { CalendarClock, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface QuoteProposalInput {
  amount: number;
  endAt: string;
  scopeSummary: string;
  startAt: string;
}

interface ProviderQuoteComposerProps {
  onSubmit: (input: QuoteProposalInput) => Promise<void>;
}

export function ProviderQuoteComposer({ onSubmit }: ProviderQuoteComposerProps) {
  const [amount, setAmount] = useState("");
  const [scopeSummary, setScopeSummary] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a service price greater than zero.");
      return;
    }
    if (!scopeSummary.trim()) {
      setError("Describe what the quoted service includes.");
      return;
    }
    if (!startAt || !endAt || start.getTime() <= Date.now() || end <= start) {
      setError("Choose a future start time and an end time after it.");
      return;
    }

    try {
      setError("");
      setIsSaving(true);
      await onSubmit({
        amount: numericAmount,
        scopeSummary: scopeSummary.trim(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
      setAmount("");
      setScopeSummary("");
      setStartAt("");
      setEndAt("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send this quote.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => { void submit(event); }} className="mx-4 mb-4 grid gap-4 rounded-xl bg-primary/8 p-4" aria-labelledby="quote-composer-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <CalendarClock className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h3 id="quote-composer-title" className="font-bold text-foreground">Send price and schedule</h3>
          <p className="mt-1 text-sm text-muted-foreground">The client reviews these details together before reserving the time.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="quote-amount">Service price</Label>
          <Input id="quote-amount" type="number" min="1" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="950.00" required />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="quote-scope">Included work</Label>
          <textarea id="quote-scope" value={scopeSummary} onChange={(event) => setScopeSummary(event.target.value)} maxLength={1000} rows={3} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Describe the agreed service and important limits." required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quote-start">Starts</Label>
          <Input id="quote-start" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quote-end">Ends</Label>
          <Input id="quote-end" type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required />
        </div>
      </div>

      {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">{error}</p> : null}
      <Button type="submit" className="justify-self-start" isLoading={isSaving}>
        <Send aria-hidden="true" />
        {isSaving ? "Sending quote..." : "Send quote"}
      </Button>
    </form>
  );
}
