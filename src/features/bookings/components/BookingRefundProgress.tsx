import { useEffect, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import { useBookingRefunds } from "../hooks/useBookingRefunds";
import { hasVerifiedRefundPayment, type BookingRefund } from "../services/bookingRefunds";

export const refundStatusLabels: Record<BookingRefund["status"], string> = {
  approved: "Refund approved", processing: "Refund processing", pending: "Refund pending",
  succeeded: "Refund sent to original payment method", failed: "Refund failed — support action required",
  needs_review: "Refund needs payment review",
};

export function BookingRefundProgress({ bookingId, caseId, requestedAt, canRequest, replacementAccepted = false, demoBooking = false, onChanged }: {
  bookingId: string; caseId: string; requestedAt?: string | null; canRequest: boolean;
  replacementAccepted?: boolean; demoBooking?: boolean; onChanged: () => void;
}) {
  const flow = useBookingRefunds(bookingId, caseId, onChanged);
  const [verification, setVerification] = useState<{ bookingId: string; revision: number; state: "verified" | "missing" | "error" } | null>(null);
  const [verificationRevision, setVerificationRevision] = useState(0);
  const requestCandidate = canRequest && !demoBooking && !replacementAccepted && !requestedAt && !flow.refunds.length;
  useEffect(() => {
    if (!requestCandidate) return;
    let active = true;
    void hasVerifiedRefundPayment(bookingId).then((verified) => {
      if (active) setVerification({ bookingId, revision: verificationRevision, state: verified ? "verified" : "missing" });
    }).catch(() => { if (active) setVerification({ bookingId, revision: verificationRevision, state: "error" }); });
    return () => { active = false; };
  }, [bookingId, requestCandidate, verificationRevision]);
  const verificationState = verification?.bookingId === bookingId && verification.revision === verificationRevision ? verification.state : "checking";
  const allSent = flow.refunds.length > 0 && flow.refunds.every((refund) => refund.status === "succeeded");
  const sentTotal = flow.refunds.reduce((total, refund) => total + (refund.status === "succeeded" ? refund.amount : 0), 0);
  if (!flow.error && !requestedAt && !flow.refunds.length && (demoBooking || !canRequest || verificationState === "missing")) return null;
  if (requestCandidate && verificationState === "checking" && !flow.error) return null;
  if (replacementAccepted && !requestedAt && !flow.refunds.length && !flow.error) return null;
  return <WorkflowPanel icon={CreditCard} title="Refund review" description="Payment review and refund progress" tone="highlight" status={<span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-brand-highlight-foreground">{flow.loading || requestCandidate && verificationState === "checking" ? "Checking payment" : allSent ? "Refund sent" : flow.refunds.length ? "Refund progress" : requestedAt ? "Review requested" : flow.error || requestCandidate && verificationState === "error" ? "Check unavailable" : "Not requested"}</span>} contentClassName="grid min-w-0 gap-3 p-4 text-sm sm:p-5">
    {flow.loading && <p role="status">Loading refund status...</p>}
    {requestedAt && !flow.refunds.length && <p>Refund review requested. Waiting for support approval.</p>}
    {!demoBooking && !replacementAccepted && !requestedAt && !flow.refunds.length && (!requestCandidate || verificationState === "verified") && <p>Support can review whether a refund is appropriate. Reporting a problem does not return money; a verified payment and support approval are required.</p>}
    {requestCandidate && verificationState === "error" && <div role="alert" className="grid gap-2"><p>Payment verification is unavailable right now. Refund review is paused until it can be checked.</p><Button type="button" variant="outline" className="w-fit" onClick={() => setVerificationRevision((value) => value + 1)}><RefreshCw aria-hidden="true" />Retry payment check</Button></div>}
    {allSent && flow.refunds.length > 1 && <p className="font-semibold text-foreground">{flow.refunds[0].currency} {sentTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })} sent across {flow.refunds.length} refunds.</p>}
    {flow.refunds.length > 0 && <ul className="grid min-w-0 gap-3 border-t pt-3 md:grid-cols-2">
      {flow.refunds.map((refund) => <li key={refund.id} className="min-w-0 rounded-lg bg-muted/50 p-3">
        <p className="font-semibold">{refund.currency} {refund.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} · {refundStatusLabels[refund.status]}</p>
        {refund.provider_refund_id && <p className="mt-1 break-all text-xs text-muted-foreground">Refund reference: {refund.provider_refund_id}</p>}
      </li>)}
    </ul>}
    {requestCandidate && verificationState === "verified" && !flow.loading && <Button type="button" className="w-fit" disabled={flow.pending} onClick={() => { void flow.run("request"); }}>Request refund review</Button>}
    {flow.refunds.some((refund) => refund.status !== "succeeded") && <Button type="button" variant="outline" className="w-fit" disabled={flow.pending} onClick={() => { void flow.run("check"); }}><RefreshCw aria-hidden="true" className={flow.pending ? "animate-spin" : ""} />Check refund status</Button>}
    {flow.message && <p role="status">{flow.message}</p>}
    {flow.error && <p role="alert" className="text-destructive">{flow.error}</p>}
  </WorkflowPanel>;
}
