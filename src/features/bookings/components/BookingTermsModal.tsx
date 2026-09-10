import { useState } from "react";
import { CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_TERMS = [
  "Share accurate booking, schedule, payment, and contact details needed to complete the service.",
  "TrabaWho processes booking records, chat messages, payment proof, and uploads only for coordination, verification, safety, and support.",
  "Mock payment steps do not move real money. Payment remains the responsibility of the client and provider until production payment is enabled.",
  "Keep agreements inside the booking conversation and never submit fraudulent information or payment proof.",
];

interface BookingTermsModalProps {
  isOpen: boolean;
  appTheme?: string;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  terms?: string[];
  agreementLabel?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}

export default function BookingTermsModal({
  isOpen,
  title = "Confirm booking terms",
  subtitle = "Review these TrabaWho booking terms before continuing.",
  confirmLabel = "Agree and continue",
  terms = DEFAULT_TERMS,
  agreementLabel = "I agree to the TrabaWho booking Terms and Conditions for this booking.",
  onCancel,
  onConfirm,
}: BookingTermsModalProps) {
  const [accepted, setAccepted] = useState(false);

  const cancel = () => {
    setAccepted(false);
    onCancel?.();
  };

  const confirm = () => {
    if (!accepted) return;
    setAccepted(false);
    onConfirm?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) cancel(); }}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="bg-muted/45 px-5 py-5 pr-16 sm:px-6 sm:py-6 sm:pr-16">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileCheck2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-2xl">{title}</DialogTitle>
              <DialogDescription className="mt-1.5 leading-6">{subtitle}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6">
          <section aria-labelledby="booking-terms-summary">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              <h3 id="booking-terms-summary" className="font-semibold text-foreground">What you are agreeing to</h3>
            </div>
            <ol className="divide-y rounded-xl bg-muted/40 px-4">
              {terms.map((term, index) => (
                <li className="flex gap-3 py-3.5 text-sm leading-6 text-muted-foreground" key={term}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-primary shadow-sm" aria-hidden="true">{index + 1}</span>
                  <span>{term}</span>
                </li>
              ))}
            </ol>
          </section>

          <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl bg-brand-highlight-soft/70 p-4 text-sm font-semibold leading-6 text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>{agreementLabel}</span>
          </label>
        </div>

        <DialogFooter className="bg-background px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
          <Button type="button" onClick={confirm} disabled={!accepted}>
            <CheckCircle2 aria-hidden="true" />
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
