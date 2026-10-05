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
  const availableAmount = Math.max(0, paidAmount - flow.refunds.filter((refund) => !["succeeded", "simulated"].includes(refund.status)).reduce((sum, refund) => sum + refund.amount, 0));
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  return <section aria-label="Refund decision" className="grid gap-3 rounded-lg bg-muted/40 p-4">
    <h3 className="flex items-center gap-2 font-semibold"><RotateCcw aria-hidden="true" className="size-4" />Refund review</h3>
    {requestedAt && <p>The client requested refund review.</p>}
    {flow.loading && <p role="status">Loading refunds...</p>}
    {flow.refunds.map((refund) => <div key={refund.id} className="border-t pt-2"><p>{refund.currency} {refund.amount.toLocaleString("en-PH")} · {refundStatusLabels[refund.status]}</p>{refund.provider_refund_id && <p className="break-all text-xs">Reference: {refund.provider_refund_id}</p>}</div>)}
    {!closed && availableAmount > 0 && !flow.loading && <>
      <p>Complete a sandbox refund decision for verified test payments: <strong>PHP {availableAmount.toLocaleString("en-PH")}</strong>, including the collected platform fee. The case closes only after all refundable attempts resolve; no real money is returned.</p>
      <label className="grid gap-1 font-medium">Refund approval reason<textarea className="min-h-24 rounded-md border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reason} disabled={flow.pending} onChange={(event) => setReason(event.target.value)} placeholder="Explain the evidence and decision (at least 20 characters)" /></label>
      {noShowBlockedReason && <p className="text-sm text-amber-800 dark:text-amber-200">{noShowBlockedReason}</p>}
      <Button type="button" variant="destructive" className="w-fit" disabled={incomplete || Boolean(noShowBlockedReason) || Boolean(flow.error) || flow.pending || reason.trim().length < 20} onClick={() => setConfirming(true)}>Approve test refund</Button>
    </>}
    {!flow.loading && !paidAmount && !flow.refunds.length && <p>No unrefunded PayMongo payment is available. A manual or demo receipt cannot be refunded through PayMongo.</p>}
    {!flow.loading && !paidAmount && flow.refunds.some((refund) => refund.status === "succeeded" || refund.status === "simulated") && <p>All recorded test payments for this case have a completed refund result. Simulated results did not return money.</p>}
    {(flow.error || flow.refunds.some((refund) => !["succeeded", "simulated"].includes(refund.status))) && <Button type="button" variant="outline" disabled={flow.pending} className="w-fit" onClick={() => { void flow.run("check"); }}>Check refund status</Button>}
    {flow.message && <p role="status">{flow.message}</p>}
    {flow.error && <p role="alert" className="text-destructive">{flow.error}</p>}
    <AlertDialog open={confirming} onOpenChange={setConfirming}><AlertDialogContent><AlertDialogHeader>
      <AlertDialogTitle>Simulate this refund in full?</AlertDialogTitle><AlertDialogDescription>Record a PHP {availableAmount.toLocaleString("en-PH")} sandbox refund after your review. The refund case closes only after every paid attempt is resolved. A cancelled appointment stays cancelled. PayMongo will not return real money; this decision cannot be undone.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep reviewing</AlertDialogCancel><AlertDialogAction onClick={() => { void flow.run("approve", reason, availableAmount); }}>Confirm test refund</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
