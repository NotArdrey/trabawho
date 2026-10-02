import { useEffect, useRef, useState } from "react";
import { AlertCircle, ClipboardList, ExternalLink, RefreshCw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/forms";
import { getSupportCaseDetail, openSupportEvidence, recordSupportFollowup,
  type SupportAction, type SupportCase, type SupportCaseDetail, type TargetParty } from "@/features/admin/services/adminSupportService";

const actionLabels: Record<SupportAction, string> = {
  request_information: "Record information needed",
  rework_arranged: "Recommend rework arrangement",
  reschedule_needed: "Recommend rescheduling",
  refund_review_needed: "Refer for refund review",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
}

export function AdminCaseDetailDialog({ item, onClose, onSaved }: {
  item: SupportCase | null; onClose: () => void; onSaved: () => void;
}) {
  const [detail, setDetail] = useState<SupportCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [reload, setReload] = useState(0);
  const [success, setSuccess] = useState("");
  const [action, setAction] = useState<SupportAction>("request_information");
  const [targetParty, setTargetParty] = useState<TargetParty>("both");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const operationId = useRef(crypto.randomUUID());
  const inFlight = useRef(false);

  useEffect(() => {
    if (!item) return;
    let active = true;
    void getSupportCaseDetail(item).then((value) => { if (active) { setDetail(value); setDetailError(""); } })
      .catch((cause: unknown) => { if (active) setDetailError(cause instanceof Error ? cause.message : "Could not load case details."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item, reload]);

  const changeForm = () => { operationId.current = crypto.randomUUID(); setError(""); setSuccess(""); };
  const save = async () => {
    if (!item || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await recordSupportFollowup({ caseId: item.id, action, targetParty, reason, operationId: operationId.current });
      setDetail(await getSupportCaseDetail(item));
      setSuccess("Support follow-up recorded. No payment or refund was changed.");
      setReason("");
      operationId.current = crypto.randomUUID();
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this follow-up.");
    } finally { inFlight.current = false; setPending(false); }
  };
  const viewEvidence = async (path: string) => {
    setError("");
    try { window.open(await openSupportEvidence(path), "_blank", "noopener,noreferrer"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open evidence."); }
  };

  const booking = detail?.booking;
  const client = detail?.people.find((person) => person.user_id === booking?.buyer_id);
  const provider = detail?.people.find((person) => person.user_id === booking?.seller_id);
  return <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent showClose={false} className="flex max-w-3xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader className="shrink-0 bg-primary/5 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><DialogTitle>Support case detail</DialogTitle><DialogDescription className="mt-1">Review the report, booking history, and evidence before recording a next step. No action here moves money.</DialogDescription></div><DialogClose disabled={pending} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close"><X className="size-5" aria-hidden="true" /></DialogClose></div></DialogHeader>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The visually hidden scrollbar needs a keyboard-focusable scroll region. */}
      <div data-testid="support-case-scroll-content" role="region" tabIndex={0} aria-label="Case details, scroll for more" className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading booking history…</p>}
      {detailError && <div role="alert" className="flex gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div className="grid gap-3"><p>{detailError}</p><Button type="button" variant="outline" className="w-fit" onClick={() => { setDetailError(""); setLoading(true); setReload((value) => value + 1); }}><RefreshCw aria-hidden="true" />Retry loading details</Button></div></div>}
      {error && <p role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" aria-hidden="true" />{error}</p>}
      {item && <div className="grid gap-5 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Badge variant={item.status === "closed" ? "success" : item.status === "open" ? "warning" : "default"}>{item.status.replaceAll("_", " ")}</Badge><span className="font-semibold capitalize">{item.case_type.replaceAll("_", " ")}</span></div>
        <section className="grid gap-2 rounded-lg bg-brand-highlight-soft/60 p-4" aria-label="Reported issue"><h3 className="flex items-center gap-2 font-semibold text-brand-highlight-foreground"><AlertCircle className="size-4" aria-hidden="true" />Reported issue</h3><p className="whitespace-pre-wrap leading-6">{item.reason}</p><p className="text-xs text-muted-foreground">Reported {formatDate(item.created_at)}. {item.policy_reason || "No policy route recorded."}</p>{item.storage_path && <Button type="button" variant="outline" className="mt-2 w-fit" onClick={() => { void viewEvidence(item.storage_path || ""); }}><ExternalLink aria-hidden="true" />Open report image</Button>}</section>
        {detail && <>
          {detail.unavailable.length > 0 && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">Some records could not be loaded: {detail.unavailable.join(", ")}. Do not make a final decision from an incomplete timeline.</p>}
          <section aria-label="Booking and participants" className="rounded-lg bg-primary/5 p-4"><h3 className="font-semibold text-primary">Booking and participants</h3><p className="mt-1 break-all text-xs text-muted-foreground">Booking reference: {item.booking_id}</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><h4 className="font-semibold">Client</h4><p>{client?.full_name || booking?.buyer_id}</p><p className="break-all text-muted-foreground">{client?.email || "Contact not available"}</p></div><div><h4 className="font-semibold">Provider</h4><p>{provider?.full_name || booking?.seller_id}</p><p className="break-all text-muted-foreground">{provider?.email || "Contact not available"}</p></div><div><h4 className="font-semibold">Service and schedule</h4><p>{detail.service?.title || "Service title unavailable"}</p><p>{formatDate(booking?.start_ts || null)} · {booking?.status}</p></div><div><h4 className="font-semibold">Recorded booking amount</h4><p>{booking?.currency || "PHP"} {booking?.total_amount ?? "Not available"}</p><p className="text-muted-foreground">This is not a payout or refund balance.</p></div></div></section>
          <section aria-label="Payment attempts"><h3 className="font-semibold">Payment attempts</h3>{detail.payments.length ? <ul className="mt-2 grid gap-2">{detail.payments.map((payment) => <li key={payment.id} className="rounded-md bg-muted/60 p-2">{payment.purpose}: {payment.currency} {payment.amount} · {payment.status} · {formatDate(payment.paid_at || payment.created_at)}</li>)}</ul> : <p className="mt-1 text-muted-foreground">No payment attempts visible. Do not infer that money was paid.</p>}</section>
          <section aria-label="Delivery evidence"><h3 className="font-semibold">Delivery evidence</h3>{detail.delivery.length ? <ul className="mt-2 grid gap-2">{detail.delivery.map((proof) => <li key={proof.id} className="rounded-md bg-muted/60 p-2"><p>{proof.checklist.join(" · ")}</p>{proof.explanation && <p className="mt-1">{proof.explanation}</p>}{proof.storage_path && <Button type="button" variant="outline" className="mt-2" onClick={() => { void viewEvidence(proof.storage_path || ""); }}>Open delivery image</Button>}</li>)}</ul> : <p className="mt-1 text-muted-foreground">No delivery evidence visible.</p>}</section>
          <section aria-label="Case and booking timeline"><h3 className="font-semibold">Recorded timeline</h3><ol className="mt-2 grid gap-2 border-l pl-4">{[
            ...detail.audit.map((entry) => ({ id: `audit-${entry.id}`, at: entry.created_at, label: entry.event_type.replaceAll("_", " "), note: entry.reason })),
            ...detail.caseActions.map((entry) => ({ id: `case-${entry.id}`, at: entry.created_at, label: entry.action.replaceAll("_", " "), note: entry.note })),
            ...detail.adminActions.map((entry) => ({ id: `admin-${entry.id}`, at: entry.created_at, label: actionLabels[entry.action], note: entry.reason })),
          ].sort((a, b) => a.at.localeCompare(b.at)).map((entry) => <li key={entry.id}><p className="font-medium capitalize">{entry.label}</p><p className="text-xs text-muted-foreground">{formatDate(entry.at)}{entry.note ? ` · ${entry.note}` : ""}</p></li>)}</ol></section>
          {item.status !== "closed" && <section className="grid gap-4 rounded-lg bg-primary/5 p-4" aria-label="Record support follow-up"><div><h3 className="font-semibold text-primary">Record a next step</h3><p className="mt-1 text-xs text-muted-foreground">This is an internal case note, not a message to either party.</p></div>
            <SelectField label="Action" value={action} disabled={pending} onValueChange={(value) => { changeForm(); setAction(value as SupportAction); }} options={Object.entries(actionLabels).map(([value, label]) => ({ value, label }))} />
            {action === "request_information" && <SelectField label="Information needed from" value={targetParty} disabled={pending} onValueChange={(value) => { changeForm(); setTargetParty(value as TargetParty); }} options={[{ value: "client", label: "Client" }, { value: "provider", label: "Provider" }, { value: "both", label: "Both parties" }]} />}
            <label className="grid gap-1 font-medium">Reason and next step<textarea className="min-h-28 rounded-md border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reason} disabled={pending} onChange={(event) => { changeForm(); setReason(event.target.value); }} placeholder="Explain the evidence reviewed and what should happen next (at least 20 characters)" /></label>
            <p className="text-xs text-muted-foreground">A refund referral does not issue a refund. Information requests are not sent automatically.</p>
            <Button type="button" variant="primary" className="w-fit" disabled={pending || reason.trim().length < 20 || detail.unavailable.length > 0} onClick={() => { void save(); }}>{pending ? <RefreshCw className="animate-spin" aria-hidden="true" /> : null}Record follow-up</Button>
          </section>}
        </>}
        {success && <p role="status" className="text-emerald-700 dark:text-emerald-300">{success}</p>}
      </div>}
      </div>
      <DialogFooter className="shrink-0 px-4 pb-4 sm:px-6 sm:pb-5"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
