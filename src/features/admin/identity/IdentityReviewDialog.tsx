import { useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { Textarea } from "@/components/ui/textarea";
import { useIdentityReviewDetail } from "@/features/admin/hooks/useIdentityReviews";
import { IdentityEvidence } from "./IdentityEvidence";
import { useIdentityReviewDecision } from "@/features/admin/hooks/useIdentityReviewDecision";

export function IdentityReviewDialog({ reviewId, onClose, onSaved }: { reviewId: string; onClose: () => void; onSaved: () => void }) {
  const state = useIdentityReviewDetail(reviewId);
  const detail = state.data;
  const { reason, setReason, reviewedLegalName, setReviewedLegalName, evidenceReviewed, setEvidenceReviewed, confirmation, setConfirmation, saving, error, message, prepareDecision, submit, retryEmail } = useIdentityReviewDecision(reviewId, state.refresh, onSaved, Boolean(detail?.registration));
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!error && !message) return;
    feedback.current?.focus();
    feedback.current?.scrollIntoView?.({ block: 'nearest' });
  }, [error, message, state.loading]);

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-w-3xl" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }} onPointerDownOutside={(event) => { if (saving) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Identity review</DialogTitle><DialogDescription>Review the evidence and record a reason for approval or rejection.</DialogDescription></DialogHeader>
      {state.loading && <p role="status">Loading protected evidence…</p>}
      {state.error && <div role="alert" className="space-y-2"><p>{state.error}</p><Button onClick={state.refresh}>Retry loading review</Button></div>}
      {detail && <div className="min-w-0 space-y-5">
        <section className="space-y-2 rounded-lg bg-muted p-4 text-sm" aria-label="Applicant details">
          <h2 className="text-lg font-semibold">{detail.profile.full_name}</h2>
          <p className="break-all">{detail.profile.email}</p><p className="capitalize">{detail.profile.role} · {detail.review.document_type}</p>
          <p>Status: {detail.review.status.replaceAll("_", " ").toLowerCase()}</p>
          {!detail.registration && <p>Address: {[detail.profile.address, detail.profile.barangay, detail.profile.city, detail.profile.province].filter(Boolean).join(", ") || "Address unavailable"}</p>}
          {detail.registration && <div className="space-y-1"><p>Name from ID: {detail.registration.source_legal_name || 'Missing'}</p><p>Requested name: {detail.registration.requested_legal_name || 'No correction requested'}</p><p>{detail.registration.name_issue}</p>{detail.registration.reviewed_legal_name && <p>Reviewed legal name: {detail.registration.reviewed_legal_name}</p>}</div>}
          <p>ID expiry: {detail.profile.id_document_expiry || "No expiry reported"}</p>
          {detail.review.duplicate_reason && <p className="font-semibold">Duplicate check: {detail.review.duplicate_reason} ({detail.review.duplicate_match_count} matches)</p>}
          {detail.profile.account_status !== "active" && <p>Account access is {detail.profile.account_status}. Identity approval does not restore account access.</p>}
        </section>
        <IdentityEvidence detail={detail} onRefresh={state.refresh} />
        {detail.review.status === "PENDING_REVIEW" && <section className="space-y-3 border-t pt-4" aria-label="Identity decision">
          {detail.registration && <div className="space-y-2"><Label htmlFor="reviewed-legal-name">Legal name verified from evidence</Label><Input id="reviewed-legal-name" value={reviewedLegalName} maxLength={200} disabled={saving} onChange={(event) => { setReviewedLegalName(event.target.value); setConfirmation(null); }} /><p className="text-sm text-muted-foreground">Record the complete name supported by the document. A requested correction alone is not verification.</p></div>}
          <label htmlFor="identity-evidence-reviewed" className="flex min-h-11 items-center gap-3 text-sm"><Checkbox id="identity-evidence-reviewed" checked={evidenceReviewed} onChange={(event) => { setEvidenceReviewed(event.target.checked); setConfirmation(null); }} disabled={saving} />I reviewed the document, selfie, expiry, and duplicate warnings.</label>
          <div className="space-y-2"><Label htmlFor="identity-decision-reason">Decision reason</Label><Textarea id="identity-decision-reason" value={reason} maxLength={2000} disabled={saving} onChange={(event) => { setReason(event.target.value); setConfirmation(null); }} aria-describedby="identity-reason-help" placeholder="Explain how the evidence supports your decision." /><p id="identity-reason-help" className="text-xs text-muted-foreground">20–2000 characters. This reason is recorded in the review history.</p></div>
          {confirmation ? <div className="space-y-3 rounded-lg border p-3"><p className="text-sm font-semibold">{confirmation === "APPROVED" ? detail.registration ? "Approve this identity with the reviewed legal name?" : "Approve this identity? The user will still need email confirmation." : detail.registration ? "Reject this identity? Access remains blocked until the user retries verification with valid evidence." : "Reject this identity? The user will need to register again with valid evidence."}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={saving} onClick={() => setConfirmation(null)}>Cancel decision</Button><Button variant={confirmation === "DECLINED" ? "destructive" : "primary"} isLoading={saving} onClick={() => void submit()}>Confirm {confirmation === "APPROVED" ? "approval" : "rejection"}</Button></div></div>
            : <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={saving} onClick={() => prepareDecision("DECLINED")}>Reject identity</Button><Button disabled={saving} onClick={() => prepareDecision("APPROVED")}>Approve identity</Button></div>}
        </section>}
        {detail.review.status === "APPROVED" && !detail.profile.is_verified && <section className="space-y-2"><p className="text-sm">Confirmation email: {detail.review.email_delivery_status.replaceAll("_", " ")}</p>{detail.review.email_delivery_error && <p className="text-sm text-destructive">{detail.review.email_delivery_error}</p>}<Button variant="outline" isLoading={saving} onClick={() => void retryEmail()}>Retry confirmation email</Button></section>}
        {detail.history.length > 0 && <section className="space-y-3 border-t pt-4"><h3 className="text-lg font-semibold">Decision history</h3>{detail.history.map((entry) => <div key={entry.id} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{entry.decision} · {new Date(entry.created_at).toLocaleString("en-PH")}</p><p className="mt-1 whitespace-pre-wrap">{entry.reason}</p></div>)}</section>}
      </div>}
      {(error || message) && <p ref={feedback} tabIndex={-1} role={error ? 'alert' : 'status'}
        className={error ? 'rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive focus:outline-none focus:ring-2 focus:ring-ring'
          : 'rounded-lg bg-muted p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'}>{error || message}</p>}
      <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Close review</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
