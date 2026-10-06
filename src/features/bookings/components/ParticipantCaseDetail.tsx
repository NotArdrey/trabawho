import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Eye, RefreshCw } from "lucide-react";
import { paths } from "@/app/router/routes";
import { Button } from "@/components/ui/button";
import { PrivateEvidencePreview } from "@/shared/components/PrivateEvidencePreview";
import { BookingTransactionActions } from "./BookingTransactionActions";
import { BookingRefundProgress } from "./BookingRefundProgress";
import { CaseConversation } from "./CaseConversation";
import { CaseReviewPanel } from "./CaseReviewPanel";
import { ReplacementVisitActions } from "./ReplacementVisitActions";
import { getParticipantReportImage, getParticipantSupportBooking, type ParticipantSupportCase } from "../services/participantSupportCases";
import type { BookingActionRecord } from "../types/booking-action-record";
import { isShowcasePaymentReference } from "../utils/bookingPaymentPresentation";
import { isBookingFullyFunded } from "../utils/bookingPaymentGuard";

export function ParticipantCaseDetail({ item, highlightConversation = false, onUpdated }: { item: ParticipantSupportCase; highlightConversation?: boolean; onUpdated: () => void }) {
  const [booking, setBooking] = useState<BookingActionRecord | null>(null);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const bookingId = item.report.booking_id;
  useEffect(() => {
    let active = true;
    void getParticipantSupportBooking(bookingId).then((value) => {
      if (active) { setBooking(value); setError(""); }
    }).catch(() => { if (active) setError("This booking could not be loaded. Try again."); });
    return () => { active = false; };
  }, [bookingId, revision]);
  return <section aria-label="Support case progress" className="grid min-w-0 gap-5 rounded-xl border bg-card p-4 sm:p-6">
    <div className="rounded-lg bg-primary/5 p-4"><h2 className="font-semibold text-primary">Your case at a glance</h2><p className="mt-1 text-sm capitalize">Status: {(item.report.resolution_status || item.report.status).replaceAll("_", " ")}</p><p className="mt-1 text-sm">{item.report.resolution_status === "awaiting_provider" ? item.viewerRole === "provider" ? "Support is waiting for your reply below." : "Support is waiting for the provider's reply." : item.report.resolution_status === "awaiting_client" ? item.viewerRole === "client" ? "Support is waiting for your reply below." : "Support is waiting for the client's reply." : item.report.resolution_status === "replacement_proposed" ? "Review the proposed replacement visit below. It is not reserved until both participants accept." : item.report.resolution_status === "replacement_accepted" ? "Both participants accepted. The replacement time below is now the confirmed visit." : item.report.resolution_status === "refund_pending" ? "A refund is pending provider verification; it has not been confirmed yet." : item.report.status === "closed" ? "This case is resolved. You can review its history below." : "Support is reviewing the report. You can add information below."}</p>{item.report.response_due_at && <p className="mt-1 text-xs text-muted-foreground">Support review target: {new Date(item.report.response_due_at).toLocaleString("en-PH")}. This is not an automatic decision deadline.</p>}</div>
    <div className="rounded-lg bg-brand-highlight-soft/60 p-4"><h3 className="flex items-center gap-2 font-semibold text-brand-highlight-foreground"><AlertCircle className="size-4" aria-hidden="true" />Reported problem</h3><p className="mt-2 whitespace-pre-wrap text-sm">{item.report.reason}</p></div>
    {item.report.storage_path && <Button variant="outline" className="w-fit" onClick={() => setPreviewOpen(true)}><Eye aria-hidden="true" />Preview report image</Button>}
    <PrivateEvidencePreview path={previewOpen ? item.report.storage_path : null} title="Reported issue image" description={`Attached to this report · ${new Date(item.report.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}`} loadUrl={getParticipantReportImage} onClose={() => setPreviewOpen(false)} />
    {error ? <div role="alert" className="grid gap-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" className="w-fit" onClick={() => setRevision((value) => value + 1)}><RefreshCw aria-hidden="true" />Retry loading case</Button></div>
      : !booking && <p role="status" className="text-sm text-muted-foreground">Loading case progress…</p>}
    <CaseConversation caseId={item.report.id} bookingId={bookingId} viewerRole={item.viewerRole} closed={item.report.status === "closed"} highlighted={highlightConversation} onChanged={onUpdated} />
    <div className="grid gap-4 border-t pt-5" aria-label="Resolution options">
      <div><h3 className="text-base font-semibold">Resolution and next steps</h3><p className="mt-1 text-sm text-muted-foreground">Track the available remedies and any action needed from you.</p></div>
      {item.report.case_type === "provider_no_show" && <ReplacementVisitActions caseId={item.report.id} bookingId={bookingId} viewerRole={item.viewerRole} funded={Boolean(booking && isBookingFullyFunded(booking))} onChanged={() => { setRevision((value) => value + 1); onUpdated(); }} />}
      {item.report.resolution_status === "replacement_accepted" && item.report.status !== "closed" && <div className="grid gap-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"><h3 className="font-semibold text-primary">Need help with the new visit?</h3><p>The agreed visit remains active. If the provider cannot attend or another problem occurs, tell support what changed; a refund is not automatic.</p><Button asChild variant="outline" className="w-fit"><Link to={`${paths.supportCases}?case=${item.report.id}#case-conversation`}>Contact support about this visit</Link></Button></div>}
      {booking && item.report.case_type === "provider_no_show" && <BookingRefundProgress bookingId={bookingId} caseId={item.report.id} requestedAt={item.report.refund_requested_at} replacementAccepted={item.report.resolution_status === "replacement_accepted"} demoBooking={isShowcasePaymentReference(booking.paymentReference)} canRequest={item.viewerRole === "client" && item.report.resolution_status !== "replacement_accepted" && item.report.status !== "closed" && ["paid", "partially_paid"].includes(booking.paymentStatus || "")} onChanged={onUpdated} />}
      <CaseReviewPanel caseId={item.report.id} viewerRole={item.viewerRole} closed={item.report.status === "closed"} onChanged={onUpdated} />
    </div>
    {booking && item.report.case_type !== "provider_no_show" && <div className="border-t pt-4"><h3 className="mb-3 font-semibold">Booking actions</h3><BookingTransactionActions booking={{ ...booking, disputeStatus: item.report.status === "closed" ? "closed" : "open" }}
      supportCaseId={item.report.id} viewerRole={item.viewerRole} onUpdated={() => { setRevision((value) => value + 1); onUpdated(); }} /></div>}
    <details className="border-t pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Case and booking references</summary><p className="mt-2 break-all">Case: {item.report.id}</p><p className="break-all">Booking: {bookingId}</p></details>
  </section>;
}
