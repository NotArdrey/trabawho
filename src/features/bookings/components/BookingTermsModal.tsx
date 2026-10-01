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

interface BookingTerm {
  detail: string;
  title: string;
}

const DEFAULT_TERMS: BookingTerm[] = [
  { title: "Booking details", detail: "Confirm that the provider, service, schedule, and payment amount are correct." },
  { title: "15-minute reservation", detail: "Your chosen time is held while you complete checkout. If it expires, your request remains saved." },
  { title: "Changes and cancellations", detail: "Unpaid bookings cancel immediately. Paid changes require provider review and do not guarantee an automatic refund." },
  { title: "Demo payment", detail: "PayMongo is in test mode, so no real card charge is made." },
];

interface BookingTermsModalProps {
  isOpen: boolean;
  appTheme?: string;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  terms?: Array<string | BookingTerm>;
  agreementLabel?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}

export default function BookingTermsModal({
  isOpen,
  title = "Review before payment",
  subtitle = "Confirm the key booking and payment rules before opening secure checkout.",
  confirmLabel = "Agree and open checkout",
  terms = DEFAULT_TERMS,
  agreementLabel = "I have reviewed and agree to these booking terms.",
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
      <DialogContent className="max-h-[calc(100svh-1rem)] max-w-2xl gap-0 overflow-hidden p-0 sm:max-h-[calc(100svh-2rem)]">
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

        <div className="grid min-h-0 gap-5 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <section aria-labelledby="booking-terms-summary">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              <h3 id="booking-terms-summary" className="font-semibold text-foreground">What you are agreeing to</h3>
            </div>
            <ol className="divide-y rounded-xl bg-muted/40 px-4">
              {terms.map((term, index) => {
                const item = typeof term === "string" ? { title: `Term ${index + 1}`, detail: term } : term;
                return (
                <li className="flex gap-3 py-3.5 text-sm leading-6 text-muted-foreground" key={`${item.title}-${index}`}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-primary shadow-sm" aria-hidden="true">{index + 1}</span>
                  <span><strong className="block text-foreground">{item.title}</strong><span className="mt-0.5 block">{item.detail}</span></span>
                </li>
                );
              })}
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

        <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={cancel}>Cancel</Button>
          <Button type="button" className="w-full sm:w-auto" onClick={confirm} disabled={!accepted}>
            <CheckCircle2 aria-hidden="true" />
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
