import { useState } from "react";
import { ClipboardCheck } from "lucide-react";

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
import type { ReviewDecision } from "@/features/bookings/types/booking-transactions";

interface BookingRequestReviewDialogProps {
  description: string;
  onClose: () => void;
  onDecision: (decision: ReviewDecision, note: string) => Promise<void>;
  open: boolean;
  title: string;
}

export function BookingRequestReviewDialog({ description, onClose, onDecision, open, title }: BookingRequestReviewDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const decide = async (decision: ReviewDecision) => {
    try {
      setError("");
      setIsSaving(true);
      await onDecision(decision, note.trim());
      setNote("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to review this request.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isSaving) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardCheck className="size-5" aria-hidden="true" /></span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="review-note">Note to the other participant (optional)</Label>
          <textarea id="review-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {error ? <p className="text-sm font-semibold text-destructive" role="alert">{error}</p> : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button type="button" variant="outline" disabled={isSaving}>Back</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button type="button" variant="outline" disabled={isSaving} onClick={(event) => { event.preventDefault(); void decide("decline"); }}>Decline</Button></AlertDialogAction>
          <AlertDialogAction asChild><Button type="button" isLoading={isSaving} onClick={(event) => { event.preventDefault(); void decide("approve"); }}>Approve request</Button></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
