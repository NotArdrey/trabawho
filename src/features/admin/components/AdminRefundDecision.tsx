import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { refundStatusLabels, useBookingRefunds } from "@/features/bookings";

export function AdminRefundDecision({ bookingId, caseId, paidAmount, closed, incomplete, requestedAt, onSaved, noShowBlockedReason }: {
  bookingId: string; caseId: string; paidAmount: number; closed: boolean; incomplete: boolean;
  requestedAt?: string | null; onSaved: () => void; noShowBlockedReason?: string;
}) {
  const flow = useBookingRefunds(bookingId, caseId, onSaved);
  const availableAmount = Math.max(0, paidAmount - flow.refunds.filter((refund) => refund.status !== "succeeded").reduce((sum, refund) => sum + refund.amount, 0));
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  return <section aria-label="Refund decision" className="grid gap-3 rounded-lg bg-muted/40 p-4">
    <h3 className="flex items-center gap-2 font-semibold"><RotateCcw aria-hidden="true" className="size-4" />Dispute refund</h3>
    {requestedAt && <p>The client requested refund review.</p>}
    {flow.loading && <p role="status">Loading refunds...</p>}
    {flow.refunds.map((refund) => <div key={refund.id} className="border-t pt-2"><p>{refund.currency} {refund.amount.toLocaleString("en-PH")} · {refundStatusLabels[refund.status]}</p>{refund.provider_refund_id && <p className="break-all text-xs">Reference: {refund.provider_refund_id}</p>}</div>)}
    {!closed && availableAmount > 0 && !flow.loading && <>
      <p>Refund all verified booking payments: <strong>PHP {availableAmount.toLocaleString("en-PH")}</strong>, including the collected platform fee. Funds return to the original payment method.</p>
      <label className="grid gap-1 font-medium">Refund approval reason<textarea className="min-h-24 rounded-md border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reason} disabled={flow.pending} onChange={(event) => setReason(event.target.value)} placeholder="Explain the evidence and decision (at least 20 characters)" /></label>
      {noShowBlockedReason && <p className="text-sm text-amber-800 dark:text-amber-200">{noShowBlockedReason}</p>}
      <Button type="button" variant="destructive" className="w-fit" disabled={incomplete || Boolean(noShowBlockedReason) || Boolean(flow.error) || flow.pending || reason.trim().length < 20} onClick={() => setConfirming(true)}>Approve full refund</Button>
    </>}
    {!flow.loading && !paidAmount && !flow.refunds.length && <p>No verified payments are available to refund.</p>}
    {(flow.error || flow.refunds.some((refund) => refund.status !== "succeeded")) && <Button type="button" variant="outline" disabled={flow.pending} className="w-fit" onClick={() => { void flow.run("check"); }}>Check refund status</Button>}
    {flow.message && <p role="status">{flow.message}</p>}
    {flow.error && <p role="alert" className="text-destructive">{flow.error}</p>}
    <AlertDialog open={confirming} onOpenChange={setConfirming}><AlertDialogContent><AlertDialogHeader>
      <AlertDialogTitle>Refund this booking in full?</AlertDialogTitle><AlertDialogDescription>Submit PHP {availableAmount.toLocaleString("en-PH")} to PayMongo for return to the client&apos;s original payment method. This approval cannot be undone. The booking closes only after every refund is verified.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep reviewing</AlertDialogCancel><AlertDialogAction onClick={() => { void flow.run("approve", reason, availableAmount); }}>Confirm full refund</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
