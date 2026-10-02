import { RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return <section aria-label="Dispute refund" className="grid min-w-0 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
    <h3 className="flex items-center gap-2 font-semibold"><RotateCcw aria-hidden="true" className="size-4" />Dispute refund</h3>
    {flow.loading && <p role="status">Loading refund status...</p>}
    {requestedAt && !flow.refunds.length && <p>Refund review requested. Waiting for support approval.</p>}
    {!requestedAt && !flow.refunds.length && <p>Support can review a refund for this report. A report alone does not return money.</p>}
    {flow.refunds.map((refund) => <div key={refund.id} className="min-w-0 border-t pt-2">
      <p className="font-semibold">{refund.currency} {refund.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} · {refundStatusLabels[refund.status]}</p>
      {refund.provider_refund_id && <p className="mt-1 break-all text-xs">Refund reference: {refund.provider_refund_id}</p>}
    </div>)}
    {canRequest && !requestedAt && !flow.refunds.length && !flow.loading && <Button type="button" variant="outline" className="w-fit" disabled={flow.pending} onClick={() => { void flow.run("request"); }}>Request refund review</Button>}
    {(flow.error || flow.refunds.some((refund) => refund.status !== "succeeded")) && <Button type="button" variant="outline" className="w-fit" disabled={flow.pending} onClick={() => { void flow.run("check"); }}><RefreshCw aria-hidden="true" className={flow.pending ? "animate-spin" : ""} />Check refund status</Button>}
    {flow.message && <p role="status">{flow.message}</p>}
    {flow.error && <p role="alert" className="text-destructive">{flow.error}</p>}
  </section>;
}
