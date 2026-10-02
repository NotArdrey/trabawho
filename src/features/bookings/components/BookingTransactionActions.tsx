import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, FileCheck2, Flag, LoaderCircle, Play, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilePicker } from "@/components/ui/file-picker";
import { SelectField } from "@/components/forms";
import { performBookingLifecycleAction } from "@/features/bookings/services/bookingLifecycle";
import { RepairCaseResolution } from "@/features/bookings/components/RepairCaseResolution";
import { BookingRefundProgress } from "./BookingRefundProgress";
import { isBookingFullyFunded, type BookingFunding } from "../utils/bookingPaymentGuard";
import {
  deliverBookingWithEvidence, getBookingDeliveryEvidence, getBookingSupportCase, openBookingSupportCase, respondToRepairClaim, startBookingWork,
  type BookingCaseType, type RepairClaimResponse,
} from "@/features/bookings/services/bookingTransactions";

interface BookingRecord extends BookingFunding {
  id: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  disputeStatus?: string;
  scheduleStatus?: string;
  scheduleVersion?: number;
  workStartedAt?: string | null;
  appointmentStartAt?: string | null;
  completedAt?: string | null;
  warrantyEligible?: boolean;
  warrantyPolicyCode?: string | null;
  warrantyDurationDays?: number | null;
  raw?: { booking?: { status?: string } };
}

interface Props {
  booking: BookingRecord;
  viewerRole: "client" | "provider";
  onUpdated: (booking: unknown) => void;
}

export function BookingTransactionActions({ booking, viewerRole, onUpdated }: Props) {
  const checklistId = useId();
  const [dialog, setDialog] = useState<"start" | "delivery" | "case" | "response" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scopeChecked, setScopeChecked] = useState(false);
  const [handoverChecked, setHandoverChecked] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [caseReason, setCaseReason] = useState("");
  const [responseAction, setResponseAction] = useState<RepairClaimResponse>("offer_rework");
  const [responseText, setResponseText] = useState("");
  const [caseType, setCaseType] = useState<BookingCaseType>(viewerRole === "client" ? "provider_no_show" : "client_no_show");
  const [image, setImage] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [evidence, setEvidence] = useState<Awaited<ReturnType<typeof getBookingDeliveryEvidence>>>(null);
  const [caseSummary, setCaseSummary] = useState<{ bookingId: string; data: Awaited<ReturnType<typeof getBookingSupportCase>> } | null>(null);
  const [caseLoadError, setCaseLoadError] = useState("");
  const [caseReload, setCaseReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (booking.disputeStatus !== "open" && booking.disputeStatus !== "closed") return;
    let active = true;
    void getBookingSupportCase(booking.id).then((value) => {
      if (!active) return;
      setCaseSummary({ bookingId: booking.id, data: value });
      setCaseLoadError(value ? "" : "The report is not available yet. Retry loading it.");
    }).catch(() => { if (active) setCaseLoadError("The booking report could not be loaded. Check your connection and retry."); });
    const refreshOnFocus = () => setCaseReload((value) => value + 1);
    const timer = window.setInterval(refreshOnFocus, 30_000);
    window.addEventListener("focus", refreshOnFocus);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refreshOnFocus); };
  }, [booking.id, booking.disputeStatus, caseReload]);

  const active = ["confirmed", "in_progress"].includes(booking.raw?.booking?.status || "");
  const startAt = booking.appointmentStartAt ? new Date(booking.appointmentStartAt).getTime() : NaN;
  const ready = active && isBookingFullyFunded(booking) && booking.scheduleStatus === "confirmed" && booking.disputeStatus !== "open";
  const canStart = viewerRole === "provider" && ready && booking.deliveryStatus === "not_delivered"
    && !booking.workStartedAt && Number.isFinite(startAt) && now >= startAt - 30 * 60_000;
  const canDeliver = viewerRole === "provider" && ready && Boolean(booking.workStartedAt)
    && booking.deliveryStatus === "not_delivered";
  const canComplete = viewerRole === "client" && ready && booking.deliveryStatus === "seller_claimed";
  const canReportNoShow = active && Number.isFinite(startAt) && now >= startAt;
  const canReportDelivery = viewerRole === "client" && booking.deliveryStatus === "seller_claimed";
  const canReportCompleted = viewerRole === "client" && Boolean(booking.completedAt);
  const withinRepairWindow = canReportCompleted && booking.warrantyPolicyCode === "repair_workmanship_7d"
    && now <= new Date(booking.completedAt || "").getTime() + (booking.warrantyDurationDays || 7) * 24 * 60 * 60_000;
  const canReport = booking.disputeStatus === "none" && (canReportNoShow || canReportDelivery || canReportCompleted);
  const currentCase = caseSummary?.bookingId === booking.id ? caseSummary.data : null;
  const canRespond = viewerRole === "provider" && booking.disputeStatus === "open"
    && currentCase?.case_type === "warranty_issue" && currentCase.policy_route === "rework_request"
    && currentCase.status === "open" && !currentCase.provider_responded_at;

  const run = async (operation: () => Promise<unknown>, message?: string | (() => string)) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      onUpdated(await operation());
      setSuccess(typeof message === "function" ? message() : message || "");
      setDialog(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this booking. Please try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const openCase = () => {
    setCaseType(canReportDelivery ? "delivery_issue" : canReportCompleted ? booking.warrantyEligible ? "warranty_issue" : "service_issue" : viewerRole === "client" ? "provider_no_show" : "client_no_show");
    setImage(null);
    setPhotoError("");
    setError("");
    setDialog("case");
  };

  const choosePhoto = (file: File | null) => {
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setImage(file);
      setPhotoError("Choose a JPEG, PNG, or WebP photo smaller than 5 MB.");
      return;
    }
    setImage(file);
    setPhotoError("");
  };

  const submitCase = () => {
    let route: "rework_request" | "support_review" = "support_review";
    void run(async () => {
      const result = await openBookingSupportCase(booking.id, caseType, caseReason, image);
      route = result.policyRoute;
      return result.booking;
    }, () => route === "rework_request"
      ? "Rework request saved. The provider can review it; no refund was issued."
      : "Support case saved for review. No refund was issued.");
  };

  const submitResponse = () => {
    if (!currentCase) return;
    void run(async () => {
      const updated = await respondToRepairClaim(booking.id, currentCase.id, responseAction, responseText);
      setCaseSummary({ bookingId: booking.id, data: await getBookingSupportCase(booking.id) });
      return updated;
    }, responseAction === "offer_rework"
      ? "Your rework offer was saved. Coordinate the next step with the client; this case remains open."
      : "Your response was sent to support review. The case remains unresolved.");
  };

  const viewEvidence = async () => {
    setError("");
    try { setEvidence(await getBookingDeliveryEvidence(booking.id, booking.scheduleVersion || 1)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load delivery proof."); }
  };

  return <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:col-auto sm:flex sm:flex-wrap sm:items-center" data-testid="booking-transaction-actions">
    {viewerRole === "provider" && active && !isBookingFullyFunded(booking) && ["paid", "partially_paid"].includes(booking.paymentStatus || "") && <span className="self-center text-sm font-medium text-amber-700 dark:text-amber-300">Waiting for client balance before work. Do not begin until full payment is verified.</span>}
    {canStart && <Button type="button" disabled={pending} onClick={() => { setError(""); setDialog("start"); }}><Play aria-hidden="true" />Start work</Button>}
    {canDeliver && <Button type="button" disabled={pending} onClick={() => { setImage(null); setPhotoError(""); setError(""); setDialog("delivery"); }}><FileCheck2 aria-hidden="true" />Submit delivery</Button>}
    {canComplete && <Button type="button" disabled={pending} onClick={() => { void run(() => performBookingLifecycleAction("complete", booking.id), "Completion confirmed and saved."); }}><CheckCircle2 aria-hidden="true" />Confirm completion</Button>}
    {viewerRole === "client" && booking.deliveryStatus === "seller_claimed" && <Button type="button" variant="outline" onClick={() => { void viewEvidence(); }}>View delivery proof</Button>}
    {canReport && <Button type="button" variant="outline" disabled={pending} onClick={openCase}><Flag aria-hidden="true" />Report a problem</Button>}
    {(booking.disputeStatus === "open" || booking.disputeStatus === "closed") && caseLoadError && <div role="alert" className="col-span-2 grid gap-2 text-sm text-destructive sm:basis-full"><p>{caseLoadError}</p><Button type="button" variant="outline" className="w-fit" onClick={() => { setCaseLoadError(""); setCaseReload((value) => value + 1); }}><RefreshCw aria-hidden="true" />Retry loading report</Button></div>}
    {booking.disputeStatus === "open" && <div className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:basis-full dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-semibold">{currentCase?.policy_route === "rework_request" ? viewerRole === "provider" ? "Client requested repair rework" : "Repair rework requested" : "Support case open"}</p><p className="mt-1">{currentCase?.reason || "Completion is paused while this report is reviewed."}</p>{currentCase?.policy_reason && <p className="mt-1 text-xs">{currentCase.policy_reason}</p>}{currentCase?.provider_response_action && <div className="mt-3 border-t border-amber-300 pt-3 dark:border-amber-800"><p className="font-semibold">{currentCase.provider_response_action === "offer_rework" ? "Provider offered rework" : "Provider requested support review"}</p><p className="mt-1">{currentCase.provider_response_text}</p><p className="mt-1 text-xs">This response does not close the case or change payment.</p></div>}</div>}
    {canRespond && <Button type="button" variant="outline" disabled={pending} onClick={() => { setResponseAction("offer_rework"); setResponseText(""); setError(""); setDialog("response"); }}>Respond to repair claim</Button>}
    {currentCase && currentCase.status !== "closed" && <div className="col-span-2 min-w-0 sm:basis-full"><RepairCaseResolution bookingId={booking.id} caseRecord={currentCase} viewerRole={viewerRole} onCaseChanged={(updatedBooking, updatedCase) => { setCaseSummary({ bookingId: booking.id, data: updatedCase }); onUpdated(updatedBooking); }} /></div>}
    {currentCase?.latest_support_action && <p className="col-span-2 text-sm sm:basis-full">Support update: {currentCase.latest_support_action === "refund_review_needed" ? "Referred for refund review" : currentCase.latest_support_action === "request_information" ? `Information needed from ${currentCase.latest_support_target === "both" ? "both parties" : currentCase.latest_support_target || "the booking participants"}` : currentCase.latest_support_action === "rework_arranged" ? "Rework arranged" : "Reschedule review needed"}.</p>}
    {currentCase && <div className="col-span-2 min-w-0 sm:basis-full"><BookingRefundProgress key={currentCase.id} bookingId={booking.id} caseId={currentCase.id} requestedAt={currentCase.refund_requested_at} canRequest={viewerRole === "client" && currentCase.status !== "closed" && ["paid", "partially_paid", "refund_pending"].includes(booking.paymentStatus || "")} onChanged={() => setCaseReload((value) => value + 1)} /></div>}
    {viewerRole === "provider" && ready && booking.deliveryStatus === "seller_claimed" && <span className="self-center text-sm text-muted-foreground">Waiting for client confirmation</span>}
    {evidence && <div className="col-span-2 rounded-lg border bg-muted/30 p-3 text-sm sm:basis-full"><p className="font-semibold">Delivery proof</p><p className="mt-1 text-muted-foreground">{evidence.checklist.join(" · ")}</p>{evidence.explanation && <p className="mt-2">{evidence.explanation}</p>}{evidence.imageUrl && <a className="mt-2 inline-block text-primary underline" href={evidence.imageUrl} target="_blank" rel="noreferrer">Open evidence image</a>}</div>}
    {success && <p role="status" className="col-span-2 text-sm text-emerald-700 sm:basis-full dark:text-emerald-300">{success}</p>}
    {error && !dialog && <p role="alert" className="col-span-2 text-sm text-destructive sm:basis-full">{error}</p>}

    <Dialog open={dialog === "start"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Start this work?</DialogTitle><DialogDescription>Confirm that you are ready to begin the booked service. The client will see that work has started. Submit delivery proof when the work is finished.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || !canStart} onClick={() => { void run(() => startBookingWork(booking.id, booking.scheduleVersion)); }}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}Confirm start work</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dialog === "delivery"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Submit delivery proof</DialogTitle><DialogDescription>Tell the client what was completed. Add a photo or written work notes.</DialogDescription></DialogHeader>
        <div className="grid gap-5">
          <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">Before you submit</legend>
            <label htmlFor={`${checklistId}-scope`} className="flex min-h-11 items-center gap-3 rounded-lg bg-muted/50 px-3 text-sm"><Checkbox id={`${checklistId}-scope`} checked={scopeChecked} disabled={pending} onChange={(event) => setScopeChecked(event.target.checked)} />Agreed service scope completed</label>
            <label htmlFor={`${checklistId}-handover`} className="flex min-h-11 items-center gap-3 rounded-lg bg-muted/50 px-3 text-sm"><Checkbox id={`${checklistId}-handover`} checked={handoverChecked} disabled={pending} onChange={(event) => setHandoverChecked(event.target.checked)} />Result handed over or explained to client</label>
          </fieldset>
          <div className="grid gap-3"><div><p className="text-sm font-semibold">Proof of work</p><p className="text-xs text-muted-foreground">Add a photo or describe the completed work in at least 20 characters.</p></div>
            <label className="grid gap-1.5 text-sm font-medium">Work notes<textarea className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={explanation} disabled={pending} onChange={(event) => setExplanation(event.target.value)} placeholder="For example: Replaced the damaged part and tested the result" /></label>
            <FilePicker accept="image/jpeg,image/png,image/webp" disabled={pending} file={image} hint="JPEG, PNG, or WebP, smaller than 5 MB" label="Photo (optional)" onChange={choosePhoto} />
            {photoError && <p role="alert" className="text-sm text-destructive">{photoError}</p>}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || Boolean(photoError) || !scopeChecked || !handoverChecked || (!image && explanation.trim().length < 20)} onClick={() => { void run(() => deliverBookingWithEvidence(booking.id, booking.scheduleVersion || 1, ["Agreed service scope completed", "Result handed over or explained to client"], explanation, image), "Delivery proof submitted. The client can review it now."); }}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileCheck2 aria-hidden="true" />}Submit delivery</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dialog === "case"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Report a booking problem</DialogTitle><DialogDescription>This saves a support case. It does not issue a refund or payout.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <SelectField label="Issue type" value={caseType} disabled={pending} onValueChange={(value) => setCaseType(value as BookingCaseType)} options={[
            ...(viewerRole === "client" && canReportNoShow ? [{ value: "provider_no_show", label: "Provider did not arrive" }] : []),
            ...(viewerRole === "provider" && canReportNoShow ? [{ value: "client_no_show", label: "Client did not arrive" }] : []),
            ...(canReportDelivery ? [{ value: "delivery_issue", label: "Delivered work has a problem" }] : []),
            ...(canReportCompleted && booking.warrantyEligible ? [{ value: "warranty_issue", label: "Repair workmanship issue" }] : []),
            ...(canReportCompleted && !booking.warrantyEligible ? [{ value: "service_issue", label: "Completed service issue" }] : []),
          ]} />
          {canReportCompleted && <p className="text-sm text-muted-foreground">{withinRepairWindow ? "This is within the seven-day repair window. Submitting requests rework; the provider must review the reported defect." : "This report is outside the automatic repair route and will go to support review."} No refund is automatic.</p>}
          <label className="grid gap-1 text-sm font-medium">What happened?<textarea className="min-h-28 rounded-md border bg-background p-3" value={caseReason} onChange={(event) => setCaseReason(event.target.value)} placeholder="Describe the issue and any evidence (at least 20 characters)" /></label>
          <FilePicker accept="image/jpeg,image/png,image/webp" disabled={pending} file={image} hint="JPEG, PNG, or WebP, smaller than 5 MB" label="Photo (optional)" onChange={choosePhoto} />
          {photoError && <p role="alert" className="text-sm text-destructive">{photoError}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || Boolean(photoError) || caseReason.trim().length < 20} onClick={submitCase}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Flag aria-hidden="true" />}Open support case</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dialog === "response"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Respond to repair claim</DialogTitle><DialogDescription>Offer to inspect or rework the reported issue, or ask support to review it. Your answer does not decide coverage, close the case, or move money.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <SelectField label="Next step" value={responseAction} disabled={pending} onValueChange={(value) => setResponseAction(value as RepairClaimResponse)} options={[{ value: "offer_rework", label: "Offer inspection or rework" }, { value: "request_support_review", label: "Request support review" }]} />
          <label className="grid gap-1 text-sm font-medium">Your response<textarea className="min-h-28 rounded-md border bg-background p-3" value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Explain what you can do next, or why support should review the report (at least 20 characters)" /></label>
          <p className="text-xs text-muted-foreground">Do not include contact details or sensitive documents here. Use the booking conversation to arrange a time with the client.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || responseText.trim().length < 20} onClick={submitResponse}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileCheck2 aria-hidden="true" />}Send response</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
