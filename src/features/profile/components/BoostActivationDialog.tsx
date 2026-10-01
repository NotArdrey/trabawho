import { Rocket, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BoostActivationDialogProps {
  budget: number;
  days: number;
  error?: string;
  isOpen: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  serviceTitle: string;
}

const formatPhp = (amount: number) => `PHP ${amount.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

export function BoostActivationDialog({ budget, days, error, isOpen, isSaving, onCancel, onConfirm, serviceTitle }: BoostActivationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onCancel(); }}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-lg gap-0 overflow-y-auto p-0 sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="border-b bg-muted/40 px-5 py-5 pr-16 sm:px-6">
          <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Rocket className="size-5" aria-hidden="true" /></span>
          <DialogTitle>Activate demo gig boost</DialogTitle>
          <DialogDescription className="mt-1">Review the gig and boost settings before activation.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 px-5 py-5 sm:px-6">
          <dl className="grid gap-3 rounded-xl bg-muted/45 p-4 text-sm">
            <div><dt className="text-muted-foreground">Gig</dt><dd className="mt-1 font-bold text-foreground">{serviceTitle}</dd></div>
            <div className="flex justify-between gap-4 border-t pt-3"><dt className="text-muted-foreground">Duration</dt><dd className="font-semibold text-foreground">{days} {days === 1 ? "day" : "days"}</dd></div>
            <div className="flex justify-between gap-4 border-t pt-3"><dt className="text-muted-foreground">Demo budget</dt><dd className="text-lg font-extrabold text-primary">{formatPhp(budget)}</dd></div>
          </dl>
          <p className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-foreground"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>This is a demo activation. No card, GCash transfer, or real payment is collected.</span></p>
          {error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{error}</p> : null}
        </div>

        <DialogFooter className="sticky bottom-0 bg-background px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button type="button" onClick={onConfirm} isLoading={isSaving}><Rocket aria-hidden="true" />Activate demo boost</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
