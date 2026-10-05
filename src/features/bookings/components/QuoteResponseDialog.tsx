import { useState } from "react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type QuoteResponseAction = "request_changes" | "decline";

interface QuoteResponseDialogProps {
  action: QuoteResponseAction | null;
  onClose: () => void;
  onSubmit: (action: QuoteResponseAction, feedback: string) => Promise<void>;
}

export function QuoteResponseDialog({ action, onClose, onSubmit }: QuoteResponseDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const close = () => { setFeedback(""); setError(""); onClose(); };
  const submit = async (selected: QuoteResponseAction) => {
    if (selected === "request_changes" && !feedback.trim()) { setError("Tell the provider what you would like changed."); return; }
    try {
      setError(""); setSaving(true);
      await onSubmit(selected, feedback.trim());
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to respond to this quote. Try again.");
    } finally { setSaving(false); }
  };

  return <>
    <Dialog open={action === "request_changes"} onOpenChange={(open) => { if (!open && !saving) close(); }}>
      <DialogContent><DialogHeader><DialogTitle>Request changes to this quote</DialogTitle>
        <DialogDescription>The offer will no longer be payable. The provider can send a revised price and time.</DialogDescription></DialogHeader>
        <div className="grid gap-2"><Label htmlFor="quote-change-feedback">What should change?</Label><Textarea id="quote-change-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={1000} placeholder="For example, please include the materials and propose a later start time." aria-describedby={error ? "quote-response-error" : undefined} /></div>
        {error ? <p id="quote-response-error" role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={close} disabled={saving}>Keep quote</Button><Button type="button" onClick={() => { void submit("request_changes"); }} isLoading={saving}>Send change request</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={action === "decline"} onOpenChange={(open) => { if (!open && !saving) close(); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Decline this quote and close the request?</AlertDialogTitle>
        <AlertDialogDescription>This ends the unpaid booking request. To work with this provider later, start a new request.</AlertDialogDescription></AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter><AlertDialogCancel asChild><Button type="button" variant="outline" disabled={saving} onClick={close}>Keep request</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button type="button" variant="destructive" disabled={saving} isLoading={saving} onClick={(event) => { event.preventDefault(); void submit("decline"); }}>Decline and close</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
