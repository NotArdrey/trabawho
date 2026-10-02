import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileCheck2, Flag, LoaderCircle, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { performBookingLifecycleAction } from "@/features/bookings/services/bookingLifecycle";
import {
  deliverBookingWithEvidence, getBookingDeliveryEvidence, getBookingSupportCase, openBookingSupportCase, startBookingWork,
  type BookingCaseType,
} from "@/features/bookings/services/bookingTransactions";

interface BookingRecord {
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
  const [dialog, setDialog] = useState<"delivery" | "case" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scopeChecked, setScopeChecked] = useState(false);
  const [handoverChecked, setHandoverChecked] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [caseReason, setCaseReason] = useState("");
  const [caseType, setCaseType] = useState<BookingCaseType>(viewerRole === "client" ? "provider_no_show" : "client_no_show");
  const [image, setImage] = useState<File | null>(null);
  const [evidence, setEvidence] = useState<Awaited<ReturnType<typeof getBookingDeliveryEvidence>>>(null);
  const [caseSummary, setCaseSummary] = useState<{ bookingId: string; data: Awaited<ReturnType<typeof getBookingSupportCase>> } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (booking.disputeStatus !== "open") return;
    let active = true;
    void getBookingSupportCase(booking.id).then((value) => { if (active) setCaseSummary({ bookingId: booking.id, data: value }); }).catch(() => { if (active) setCaseSummary(null); });
    return () => { active = false; };
  }, [booking.id, booking.disputeStatus]);

  const active = ["confirmed", "in_progress"].includes(booking.raw?.booking?.status || "");
  const startAt = booking.appointmentStartAt ? new Date(booking.appointmentStartAt).getTime() : NaN;
  const ready = active && booking.paymentStatus === "paid" && booking.scheduleStatus === "confirmed" && booking.disputeStatus !== "open";
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
  const canReport = booking.disputeStatus !== "open" && (canReportNoShow || canReportDelivery || canReportCompleted);

  const run = async (operation: () => Promise<unknown>, message: string | (() => string)) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      onUpdated(await operation());
      setSuccess(typeof message === "function" ? message() : message);
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
    setError("");
    setDialog("case");
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

  const viewEvidence = async () => {
    setError("");
    try { setEvidence(await getBookingDeliveryEvidence(booking.id, booking.scheduleVersion || 1)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load delivery proof."); }
  };

  return <div className="col-span-2 grid gap-2 sm:col-auto">
    {viewerRole === "provider" && booking.paymentStatus === "partially_paid" && <span className="self-center text-sm font-medium text-amber-700 dark:text-amber-300">Waiting for client balance before work</span>}
    {canStart && <Button type="button" disabled={pending} onClick={() => { void run(() => startBookingWork(booking.id, booking.scheduleVersion), "Work started. The client can see this update."); }}><Play aria-hidden="true" />Start work</Button>}
    {canDeliver && <Button type="button" disabled={pending} onClick={() => { setImage(null); setError(""); setDialog("delivery"); }}><FileCheck2 aria-hidden="true" />Submit delivery</Button>}
    {canComplete && <Button type="button" disabled={pending} onClick={() => { void run(() => performBookingLifecycleAction("complete", booking.id), "Completion confirmed and saved."); }}><CheckCircle2 aria-hidden="true" />Confirm completion</Button>}
    {viewerRole === "client" && booking.deliveryStatus === "seller_claimed" && <Button type="button" variant="outline" onClick={() => { void viewEvidence(); }}>View delivery proof</Button>}
    {canReport && <Button type="button" variant="outline" disabled={pending} onClick={openCase}><Flag aria-hidden="true" />Report a problem</Button>}
    {booking.disputeStatus === "open" && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-semibold">{caseSummary?.bookingId === booking.id && caseSummary.data?.policy_route === "rework_request" ? viewerRole === "provider" ? "Client requested repair rework" : "Repair rework requested" : "Support case open"}</p><p className="mt-1">{caseSummary?.bookingId === booking.id && caseSummary.data?.reason || "Completion is paused while this report is reviewed."}</p>{caseSummary?.bookingId === booking.id && caseSummary.data?.policy_reason && <p className="mt-1 text-xs">{caseSummary.data.policy_reason}</p>}</div>}
    {viewerRole === "provider" && booking.deliveryStatus === "seller_claimed" && <span className="self-center text-sm text-muted-foreground">Waiting for client confirmation</span>}
    {evidence && <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-semibold">Delivery proof</p><p className="mt-1 text-muted-foreground">{evidence.checklist.join(" · ")}</p>{evidence.explanation && <p className="mt-2">{evidence.explanation}</p>}{evidence.imageUrl && <a className="mt-2 inline-block text-primary underline" href={evidence.imageUrl} target="_blank" rel="noreferrer">Open evidence image</a>}</div>}
    {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
    {error && !dialog && <p role="alert" className="max-w-80 text-sm text-destructive">{error}</p>}

    <Dialog open={dialog === "delivery"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Submit delivery proof</DialogTitle><DialogDescription>Tell the client what was completed. Add a photo or written work notes.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={scopeChecked} onChange={(event) => setScopeChecked(event.target.checked)} />Agreed service scope completed</label>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={handoverChecked} onChange={(event) => setHandoverChecked(event.target.checked)} />Result handed over or explained to client</label>
          <label className="grid gap-1 text-sm font-medium">Work notes<textarea className="min-h-24 rounded-md border bg-background p-3" value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Describe what you did (20 characters if no photo)" /></label>
          <label className="grid gap-1 text-sm font-medium">Optional photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || !scopeChecked || !handoverChecked || (!image && explanation.trim().length < 20)} onClick={() => { void run(() => deliverBookingWithEvidence(booking.id, booking.scheduleVersion || 1, ["Agreed service scope completed", "Result handed over or explained to client"], explanation, image), "Delivery proof submitted. The client can review it now."); }}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileCheck2 aria-hidden="true" />}Submit delivery</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dialog === "case"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Report a booking problem</DialogTitle><DialogDescription>This saves a support case. It does not issue a refund or payout.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-medium">Issue type<select className="min-h-11 rounded-md border bg-background px-3" value={caseType} onChange={(event) => setCaseType(event.target.value as BookingCaseType)}>{viewerRole === "client" && canReportNoShow && <option value="provider_no_show">Provider did not arrive</option>}{viewerRole === "provider" && canReportNoShow && <option value="client_no_show">Client did not arrive</option>}{canReportDelivery && <option value="delivery_issue">Delivered work has a problem</option>}{canReportCompleted && booking.warrantyEligible && <option value="warranty_issue">Repair workmanship issue</option>}{canReportCompleted && !booking.warrantyEligible && <option value="service_issue">Completed service issue</option>}</select></label>
          {canReportCompleted && <p className="text-sm text-muted-foreground">{withinRepairWindow ? "This is within the seven-day repair window. Submitting requests rework; the provider must review the reported defect." : "This report is outside the automatic repair route and will go to support review."} No refund is automatic.</p>}
          <label className="grid gap-1 text-sm font-medium">What happened?<textarea className="min-h-28 rounded-md border bg-background p-3" value={caseReason} onChange={(event) => setCaseReason(event.target.value)} placeholder="Describe the issue and any evidence (at least 20 characters)" /></label>
          <label className="grid gap-1 text-sm font-medium">Optional photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || caseReason.trim().length < 20} onClick={submitCase}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Flag aria-hidden="true" />}Open support case</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
