import { CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import { useBookingRefunds } from "../hooks/useBookingRefunds";
import type { BookingRefund } from "../services/bookingRefunds";

export const refundStatusLabels: Record<BookingRefund["status"], string> = {
  approved: "Refund approved", processing: "Refund processing", pending: "Refund pending",
  succeeded: "Refund sent to original payment method", failed: "Refund failed — support action required",
  needs_review: "Refund needs payment review",
};

export function BookingRefundProgress({ bookingId, caseId, requestedAt, canRequest, onChanged }: {
  bookingId: string; caseId: string; requestedAt?: string | null; canRequest: boolean; onChanged: () => void;
}) {
  const flow = useBookingRefunds(bookingId, caseId, onChanged);
  return <WorkflowPanel icon={CreditCard} title="Dispute refund" description="Payment review and refund progress" tone="highlight" status={<span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-brand-highlight-foreground">{flow.loading ? "Checking status" : flow.refunds.length ? "Refund progress" : requestedAt ? "Review requested" : "Not requested"}</span>} contentClassName="grid min-w-0 gap-3 p-4 text-sm sm:p-5">
    {flow.loading && <p role="status">Loading refund status...</p>}
    {requestedAt && !flow.refunds.length && <p>Refund review requested. Waiting for support approval.</p>}
    {!requestedAt && !flow.refunds.length && <p>Support can review whether a refund is appropriate. Reporting a problem does not return money; a verified payment and support approval are required.</p>}
    {flow.refunds.map((refund) => <div key={refund.id} className="min-w-0 border-t pt-2">
      <p className="font-semibold">{refund.currency} {refund.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} · {refundStatusLabels[refund.status]}</p>
      {refund.provider_refund_id && <p className="mt-1 break-all text-xs">Refund reference: {refund.provider_refund_id}</p>}
    </div>)}
    {canRequest && !requestedAt && !flow.refunds.length && !flow.loading && <Button type="button" className="w-fit" disabled={flow.pending} onClick={() => { void flow.run("request"); }}>Request refund review</Button>}
    {(flow.error || flow.refunds.some((refund) => refund.status !== "succeeded")) && <Button type="button" variant="outline" className="w-fit" disabled={flow.pending} onClick={() => { void flow.run("check"); }}><RefreshCw aria-hidden="true" className={flow.pending ? "animate-spin" : ""} />Check refund status</Button>}
    {flow.message && <p role="status">{flow.message}</p>}
    {flow.error && <p role="alert" className="text-destructive">{flow.error}</p>}
  </WorkflowPanel>;
}
