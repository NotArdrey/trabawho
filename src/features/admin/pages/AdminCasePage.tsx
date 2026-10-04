import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CalendarDays, ChevronDown, ClipboardCheck, CreditCard, Eye, FileImage, History, LockKeyhole, RefreshCw, UserRound, Wrench } from "lucide-react";

import { adminCasesPath } from "@/app/router/routes";
import { SelectField } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingRefundProgress } from "@/features/bookings/components/BookingRefundProgress";
import { CaseConversation } from "@/features/bookings/components/CaseConversation";
import { CaseReviewPanel } from "@/features/bookings/components/CaseReviewPanel";
import { PrivateEvidencePreview } from "@/shared/components/PrivateEvidencePreview";
import { caseNextActor } from "@/features/admin/domain/caseNextActor";
import { supportCaseNextStep } from "@/features/admin/domain/supportCaseNextStep";
import { supportActionLabels, supportTimeline } from "@/features/admin/domain/supportTimeline";
import { AdminRefundDecision } from "@/features/admin/components/AdminRefundDecision";
import { AdminReplacementProposal } from "@/features/admin/components/AdminReplacementProposal";
import { claimSupportCase, getCurrentAdminId, getSupportCaseById, getSupportCaseDetail,
  openSupportEvidence, recordSupportFollowup, type SupportAction, type SupportCase,
  type SupportCaseDetail } from "@/features/admin/services/adminSupportService";

type Section = "summary" | "evidence" | "conversation" | "resolution";
const sections: { key: Section; label: string }[] = [
  { key: "summary", label: "Summary" }, { key: "evidence", label: "Evidence" },
  { key: "conversation", label: "Conversation" }, { key: "resolution", label: "Resolution" },
];
const formatDate = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";

export function AdminCasePage({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState<SupportCase | null>(null);
  const [detail, setDetail] = useState<SupportCaseDetail | null>(null);
  const [adminId, setAdminId] = useState("");
  const [section, setSection] = useState<Section>("summary");
  const [evidence, setEvidence] = useState<{ path: string; title: string; date?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [revision, setRevision] = useState(0);
  const [noteAction, setNoteAction] = useState<SupportAction>("request_information");
  const [note, setNote] = useState("");
  const operationId = useRef(crypto.randomUUID());
  const inFlight = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getSupportCaseById(caseId), getCurrentAdminId()]).then(async ([record, userId]) => {
      if (!record) { if (active) { setItem(null); setDetail(null); setError("This case is unavailable to your account or no longer exists."); } return; }
      const facts = await getSupportCaseDetail(record);
      if (active) { setItem(record); setDetail(facts); setAdminId(userId); setError(""); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Case details could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId, revision]);

  const refresh = () => { setLoading(true); setRevision((value) => value + 1); };
  const canAct = Boolean(item && adminId && item.assigned_admin_id === adminId && item.status !== "closed");
  const returnToQueue = () => { void navigate(`${adminCasesPath}${location.search}`); };
  const claim = async () => {
    if (!item || pending) return;
    setPending(true); setActionError("");
    try { await claimSupportCase(item.id); setSuccess("Case assigned to you."); refresh(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Case could not be assigned. Refresh and try again."); }
    finally { setPending(false); }
  };
  const saveNote = async () => {
    if (!item || !canAct || inFlight.current || note.trim().length < 20) return;
    inFlight.current = true; setPending(true); setActionError("");
    try {
      await recordSupportFollowup({ caseId: item.id, action: noteAction, targetParty: "both", reason: note, operationId: operationId.current });
      setNote(""); operationId.current = crypto.randomUUID();
      setSuccess("Private note saved. Participants were not notified."); refresh();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "The private note could not be saved."); }
    finally { inFlight.current = false; setPending(false); }
  };
  const booking = detail?.booking;
  const client = detail?.people.find((person) => person.user_id === booking?.buyer_id);
  const provider = detail?.people.find((person) => person.user_id === booking?.seller_id);
  const verifiedIds = new Set(detail?.providerEvents.filter((event) => event.status === "processed" && event.livemode === false && event.processed_at).map((event) => event.payment_attempt_id) || []);
  const verifiedAmount = detail?.payments.filter((payment) => ["paid", "late_paid"].includes(payment.status) && payment.payment_id && verifiedIds.has(payment.id)).reduce((sum, payment) => sum + payment.amount, 0) || 0;
  const providerWasAsked = detail?.caseMessages.some((message) => message.author_role === "admin" && ["provider", "both"].includes(message.audience)) || false;
  const providerReplied = detail?.caseMessages.some((message) => message.author_role === "provider") || false;
  const nextSection: Section = !providerWasAsked || item?.resolution_status === "awaiting_provider"
    || item?.resolution_status === "awaiting_client" ? "conversation" : "resolution";
  const noShowBlockedReason = item?.case_type !== "provider_no_show" ? undefined
    : !providerWasAsked ? "Ask the provider for their account before deciding a refund."
      : !providerReplied && (!item.response_due_at || new Date(item.response_due_at).getTime() > now)
        ? "Await the provider's reply or the 24-hour review target. Silence does not prove a no-show."
        : ["replacement_proposed", "replacement_accepted"].includes(item.resolution_status)
          ? "Resolve the replacement visit before approving a refund." : undefined;

  return <div className="min-w-0 space-y-5" data-testid="admin-case-page">
    <Button type="button" variant="ghost" onClick={returnToQueue}><ArrowLeft aria-hidden="true" />Back to support cases</Button>
    {loading && <p role="status" className="rounded-lg border bg-card p-5">Loading support case…</p>}
    {error && <div role="alert" className="grid justify-items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-5"><p>{error}</p><Button type="button" variant="outline" onClick={refresh}><RefreshCw aria-hidden="true" />Retry</Button></div>}
    {item && detail && <>
      <header className="grid gap-3 rounded-xl border bg-primary/5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Support case</p><h1 className="mt-1 text-2xl font-bold capitalize">{item.case_type.replaceAll("_", " ")}</h1><p className="mt-1 text-sm text-muted-foreground">Reported {formatDate(item.created_at)}</p></div><Badge variant={item.status === "closed" ? "success" : item.status === "open" ? "warning" : "default"}>{(item.resolution_status || item.status).replaceAll("_", " ")}</Badge></div>
        <div className="grid gap-1 text-sm"><p className="font-semibold text-primary">Next action: {supportCaseNextStep(item)}</p><p>Next actor: <strong>{caseNextActor(item)}</strong> · Owner: {item.assigned_admin_id ? item.assigned_admin_id === adminId ? "You" : "Another support admin" : "Unassigned"}</p>{item.response_due_at && <p className="text-muted-foreground">Response target: {formatDate(item.response_due_at)}. This is not an automatic finding.</p>}</div>
        {!item.assigned_admin_id && item.status !== "closed" && <Button type="button" className="w-fit" disabled={pending} onClick={() => { void claim(); }}>Take ownership</Button>}
        {canAct && <Button type="button" className="w-fit" onClick={() => setSection(nextSection)}>Open {nextSection}</Button>}
        {item.status === "closed" && Boolean(item.pendingReviewCount) && <Button type="button" className="w-fit" onClick={() => setSection("resolution")}>Review new request</Button>}
        {item.assigned_admin_id && item.assigned_admin_id !== adminId && <p className="text-sm text-muted-foreground">This case is owned by another admin. You can review the record, but cannot act here.</p>}
      </header>
      {actionError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{actionError}</p>}
      {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
      <nav aria-label="Case sections" className="flex gap-2 overflow-x-auto border-b pb-2">{sections.map(({ key, label }) => <Button key={key} type="button" variant={section === key ? "primary" : "ghost"} aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}>{label}</Button>)}</nav>
      {detail.unavailable.length > 0 && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">Some records could not be loaded: {detail.unavailable.join(", ")}. Do not decide a remedy until they are available.</p>}
      <div className={section === "summary" ? "grid gap-5 lg:grid-cols-2" : "hidden"}>
        <section className="rounded-xl border bg-brand-highlight-soft/50 p-4 sm:p-5"><h2 className="flex items-center gap-2 font-semibold text-brand-highlight-foreground"><AlertCircle aria-hidden="true" className="size-4 shrink-0" />Reported issue</h2><p className="mt-3 whitespace-pre-wrap break-words leading-6">{item.reason}</p>{item.policy_reason && <p className="mt-3 text-sm text-muted-foreground">{item.policy_reason}</p>}</section>
        <section className="rounded-xl border bg-primary/5 p-4 sm:p-5"><h2 className="flex items-center gap-2 font-semibold text-primary"><CalendarDays aria-hidden="true" className="size-4 shrink-0" />People and appointment</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-medium">Client</dt><dd>{client?.full_name || "Name unavailable"}</dd><dd className="break-all text-muted-foreground">{client?.email || "Contact unavailable"}</dd></div><div><dt className="font-medium">Provider</dt><dd>{provider?.full_name || "Name unavailable"}</dd><dd className="break-all text-muted-foreground">{provider?.email || "Contact unavailable"}</dd></div><div><dt className="font-medium">Service</dt><dd>{detail.service?.title || "Service unavailable"}</dd></div><div><dt className="font-medium">Scheduled visit</dt><dd>{formatDate(booking?.start_ts)}</dd><dd className="text-muted-foreground">Booking: {booking?.status || "unavailable"}{booking?.work_started_at ? ` · Work started ${formatDate(booking.work_started_at)}` : " · Work not recorded as started"}</dd></div></dl></section>
        <section className="rounded-xl border bg-muted/40 p-4 sm:p-5 lg:col-span-2"><h2 className="flex items-center gap-2 font-semibold text-primary"><CreditCard aria-hidden="true" className="size-4 shrink-0" />Payment truth</h2><p className="mt-3 text-sm">Provider-verified test payments: <strong>PHP {verifiedAmount.toLocaleString("en-PH")}</strong></p><p className="mt-1 text-sm text-muted-foreground">Recorded booking amount: {booking?.currency || "PHP"} {booking?.total_amount ?? "unavailable"}. This amount alone does not authorize a refund.</p>{!verifiedAmount && <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"><AlertCircle aria-hidden="true" className="mr-2 inline size-4 align-[-2px]" />Payment verification needed before refund approval.</p>}</section>
      </div>
      <div className={section === "evidence" ? "grid gap-5 lg:grid-cols-2" : "hidden"}>
        <section className="rounded-xl border bg-brand-highlight-soft/50 p-4 sm:p-5"><h2 className="flex items-center gap-2 font-semibold text-brand-highlight-foreground"><FileImage aria-hidden="true" className="size-4 shrink-0" />Report evidence</h2><p className="mt-2 text-sm text-muted-foreground">Submitted {formatDate(item.created_at)}</p>{item.storage_path ? <Button type="button" variant="outline" className="mt-3" onClick={() => setEvidence({ path: item.storage_path || "", title: "Reported issue image", date: item.created_at })}><Eye aria-hidden="true" />Preview image</Button> : <p className="mt-3 text-sm text-muted-foreground">No report image attached.</p>}</section>
        <section className="rounded-xl border bg-primary/5 p-4 sm:p-5"><h2 className="flex items-center gap-2 font-semibold text-primary"><ClipboardCheck aria-hidden="true" className="size-4 shrink-0" />Delivery evidence</h2>{detail.delivery.length ? detail.delivery.map((proof) => <div key={proof.id} className="mt-3 border-t pt-3 text-sm"><p>{proof.explanation || "No written explanation"}</p><p className="mt-1 text-muted-foreground">{formatDate(proof.created_at)}</p>{proof.storage_path && <Button type="button" variant="outline" className="mt-2" onClick={() => setEvidence({ path: proof.storage_path || "", title: "Delivery evidence image", date: proof.created_at })}><Eye aria-hidden="true" />Preview image</Button>}</div>) : <p className="mt-3 text-sm text-muted-foreground">No delivery evidence visible.</p>}</section>
        <section className="rounded-xl border bg-muted/40 p-4 sm:p-5"><h2 className="flex items-center gap-2 font-semibold text-primary"><UserRound aria-hidden="true" className="size-4 shrink-0" />Provider response</h2>{item.provider_response_text ? <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.provider_response_text}</p> : <p className="mt-3 text-sm text-muted-foreground">No provider response recorded.</p>}{item.provider_response_storage_path && <Button type="button" variant="outline" className="mt-3" onClick={() => setEvidence({ path: item.provider_response_storage_path || "", title: "Provider response image", date: item.provider_responded_at || undefined })}><Eye aria-hidden="true" />Preview image</Button>}</section>
        <section className="rounded-xl border bg-primary/5 p-4 sm:p-5"><h2 className="flex items-center gap-2 font-semibold text-primary"><Wrench aria-hidden="true" className="size-4 shrink-0" />Replacement work</h2>{item.rework_evidence_note ? <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.rework_evidence_note}</p> : <p className="mt-3 text-sm text-muted-foreground">No replacement-work evidence recorded.</p>}{item.rework_evidence_path && <Button type="button" variant="outline" className="mt-3" onClick={() => setEvidence({ path: item.rework_evidence_path || "", title: "Replacement work image", date: item.rework_delivered_at || undefined })}><Eye aria-hidden="true" />Preview image</Button>}</section>
        <section className="rounded-xl border bg-muted/40 p-4 sm:p-5 lg:col-span-2"><h2 className="flex items-center gap-2 font-semibold text-primary"><CreditCard aria-hidden="true" className="size-4 shrink-0" />Payment attempts</h2>{detail.payments.length ? <ul className="mt-3 grid gap-2 text-sm">{detail.payments.map((payment) => <li key={payment.id} className="rounded-lg bg-card p-3"><strong>{payment.payment_id && verifiedIds.has(payment.id) ? "Provider-confirmed test payment" : "Not provider-confirmed"}</strong> · {payment.purpose}: {payment.currency} {payment.amount} · {payment.status} · {formatDate(payment.paid_at || payment.created_at)}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No payment attempts visible.</p>}</section>
      </div>
      <div className={section === "conversation" ? "grid gap-5" : "hidden"}><CaseConversation caseId={item.id} bookingId={item.booking_id} viewerRole="admin" closed={item.status === "closed"} readOnly={!canAct} onChanged={refresh} />
        <section className="grid gap-3 rounded-xl border bg-muted/40 p-4 sm:p-5"><div><h2 className="flex items-center gap-2 font-semibold text-primary"><LockKeyhole aria-hidden="true" className="size-4 shrink-0" />Private admin notes</h2><p className="mt-1 text-sm text-muted-foreground">Only support admins can read these notes. Use the case conversation to update participants.</p></div><ul className="grid gap-2 text-sm">{detail.adminActions.map((entry) => <li key={entry.id} className="rounded-lg bg-card p-3"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><strong className="text-primary">{supportActionLabels[entry.action]}</strong><span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap break-words">{entry.reason}</p></li>)}</ul>{!detail.adminActions.length && <p className="text-sm text-muted-foreground">No private notes recorded.</p>}{canAct && <><SelectField label="Note type" value={noteAction} disabled={pending} onValueChange={(value) => setNoteAction(value as SupportAction)} options={Object.entries(supportActionLabels).map(([value, label]) => ({ value, label }))} /><label className="grid gap-1 text-sm font-medium">Reason and next step<textarea className="min-h-28 w-full rounded-md border border-input bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={note} disabled={pending} onChange={(event) => { setNote(event.target.value); operationId.current = crypto.randomUUID(); }} /></label><Button type="button" className="w-fit" disabled={pending || note.trim().length < 20 || detail.unavailable.length > 0} onClick={() => { void saveNote(); }}>Save private note</Button></>}</section>
      </div>
      <div className={section === "resolution" ? "grid gap-5" : "hidden"}><CaseReviewPanel caseId={item.id} viewerRole="admin" closed={item.status === "closed"} readOnly={!canAct && item.status !== "closed"} onChanged={refresh} />{canAct && item.case_type === "provider_no_show" && booking && <AdminReplacementProposal caseId={item.id} serviceId={booking.service_id} providerId={booking.seller_id} onSaved={refresh} />}{canAct ? <AdminRefundDecision bookingId={item.booking_id} caseId={item.id} paidAmount={verifiedAmount} closed={item.status === "closed"} incomplete={detail.unavailable.length > 0} requestedAt={item.refund_requested_at} noShowBlockedReason={noShowBlockedReason} onSaved={refresh} /> : <BookingRefundProgress bookingId={item.booking_id} caseId={item.id} requestedAt={item.refund_requested_at} canRequest={false} onChanged={refresh} />}</div>
      <details className="group overflow-hidden rounded-xl border bg-card text-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 bg-primary/5 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><History aria-hidden="true" className="size-4" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-foreground">History and technical references</span><span className="block text-xs text-muted-foreground">Recorded case activity and IDs</span></span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t px-4 py-4 sm:px-5">
          <ol className="grid gap-4 border-l-2 border-primary/20 pl-4">{supportTimeline(detail).map((entry) => <li key={entry.id} className="min-w-0"><strong className="font-semibold capitalize text-foreground">{entry.label}</strong><p className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">{formatDate(entry.at)}{entry.note ? ` · ${entry.note}` : ""}</p></li>)}</ol>
          <div className="mt-5 border-t pt-4 text-xs text-muted-foreground"><p className="font-medium text-foreground">Technical references</p><p className="mt-1 break-all font-mono">Case: {item.id}</p><p className="mt-1 break-all font-mono">Booking: {item.booking_id}</p></div>
        </div>
      </details>
    </>}
    <PrivateEvidencePreview path={evidence?.path || null} title={evidence?.title || "Case evidence"} description={evidence ? `Private case evidence · ${formatDate(evidence.date)}` : undefined} loadUrl={openSupportEvidence} onClose={() => setEvidence(null)} />
  </div>;
}
