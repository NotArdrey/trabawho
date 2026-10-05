import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CancelBookingDialogProps {
  hasVerifiedPayment: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
  open: boolean;
  serviceName: string;
}

export function CancelBookingDialog({
  hasVerifiedPayment,
  onCancel,
  onConfirm,
  open,
  serviceName,
}: CancelBookingDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const confirm = async () => {
    if (!reason.trim()) {
      setError("Tell the other participant why you need to cancel.");
      return;
    }
    try {
      setError("");
      setIsSaving(true);
      await onConfirm(reason.trim());
      setReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to cancel this booking.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isSaving) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="size-5" aria-hidden="true" /></span>
          <AlertDialogTitle>Cancel {serviceName}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasVerifiedPayment
              ? "The other participant must agree before the visit is cancelled. Payment is reviewed separately by support; this does not return money."
              : "This cancels the unpaid booking immediately and releases the reserved time."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="cancellation-reason">Reason for cancellation</Label>
          <textarea id="cancellation-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-describedby={error ? "cancellation-error" : undefined} />
          {error ? <p id="cancellation-error" className="text-sm font-semibold text-destructive" role="alert">{error}</p> : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button type="button" variant="outline" disabled={isSaving}>Keep booking</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button type="button" variant="destructive" isLoading={isSaving} onClick={(event) => { event.preventDefault(); void confirm(); }}>{hasVerifiedPayment ? "Request cancellation" : "Cancel booking"}</Button></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
