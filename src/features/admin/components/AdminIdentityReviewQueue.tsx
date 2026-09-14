import { useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Images,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useIdentityReviews } from "@/features/admin/hooks/useIdentityReviews";
import type { AdminIdentityReview, IdentityReviewDecision } from "@/features/admin/types";
import { ConfirmActionModal } from "@/shared/components";

const decisionCopy: Record<IdentityReviewDecision, { title: string; description: string; confirmLabel: string }> = {
  APPROVE: {
    title: "Approve identity review",
    description: "This verifies the identity, activates identity-gated access after email confirmation, and starts the confirmation email flow.",
    confirmLabel: "Approve identity",
  },
  REJECT: {
    title: "Reject identity review",
    description: "This keeps the account unverified. The user will not receive account access.",
    confirmLabel: "Reject identity",
  },
  RESUBMISSION: {
    title: "Request new identity evidence",
    description: "This keeps the account unverified and allows the user to restart registration with updated verification information.",
    confirmLabel: "Request resubmission",
  },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value || "Not available"}</dd>
    </div>
  );
}

function EvidenceImage({ label, url }: { label: string; url: string | null }) {
  if (!url) return <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">{label} not available</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group grid gap-2 rounded-lg border p-2 focus-visible:ring-2 focus-visible:ring-ring">
      <img src={url} alt={label} className="h-36 w-full rounded-md bg-muted object-contain" />
      <span className="text-center text-xs font-semibold text-primary group-hover:underline">Open {label.toLowerCase()}</span>
    </a>
  );
}

interface IdentityReviewDialogProps {
  review: AdminIdentityReview;
  isSaving: boolean;
  onClose: () => void;
  onDecide: (decision: IdentityReviewDecision, note: string) => Promise<void>;
}

function IdentityReviewDialog({ review, isSaving, onClose, onDecide }: IdentityReviewDialogProps) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [pendingDecision, setPendingDecision] = useState<IdentityReviewDecision | null>(null);
  const isManual = review.source === "MANUAL_UPLOAD";

  const requestDecision = (decision: IdentityReviewDecision) => {
    if (!note.trim()) {
      setNoteError("Add a decision note before continuing.");
      document.getElementById("identity-decision-note")?.focus();
      return;
    }
    setNoteError("");
    setPendingDecision(decision);
  };

  const confirmation = pendingDecision ? decisionCopy[pendingDecision] : null;

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Identity review</DialogTitle>
            <DialogDescription>Review account, location, and identity evidence before recording a decision.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">Pending review</Badge>
            <Badge variant="outline">{isManual ? "Manual registration" : "Didit exception"}</Badge>
            <Badge variant="secondary">{review.accountType === "worker" ? "Worker" : "Client"}</Badge>
          </div>

          <section aria-labelledby="review-registration-heading" className="grid gap-3">
            <h3 id="review-registration-heading" className="flex items-center gap-2 font-semibold"><UserRound className="size-4 text-primary" aria-hidden="true" /> Registration details</h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Account type" value={review.accountType === "worker" ? "Worker" : "Client"} />
              <Detail label="Security email" value={review.email} />
              <Detail label="Province" value={review.location.province} />
              <Detail label="City or municipality" value={review.location.city} />
              <Detail label="Barangay" value={review.location.barangay} />
              <Detail label="Specific address" value={review.location.address} />
            </dl>
            <p className="text-xs text-muted-foreground">Passwords and authentication credentials are never shown in the review workspace.</p>
          </section>

          <section aria-labelledby="review-identity-heading" className="grid gap-3 border-t pt-4">
            <h3 id="review-identity-heading" className="flex items-center gap-2 font-semibold"><FileCheck2 className="size-4 text-primary" aria-hidden="true" /> Identity information</h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Document" value={review.identity.documentType} />
              <Detail label="Name on ID" value={review.identity.nameOnId} />
              <Detail label="ID number" value={review.identity.idNumber} />
              <Detail label="Expiry date" value={review.identity.expiryDate} />
              <Detail label="Submitted" value={formatDate(review.submittedAt)} />
              <Detail label="Decision target" value={formatDate(review.expectedDecisionBy)} />
            </dl>

            {review.identity.duplicateReason ? (
              <div role="status" className="flex gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{review.identity.duplicateReason} Matches found: {review.identity.duplicateMatchCount}.</p>
              </div>
            ) : null}

            {isManual ? (
              <div className="grid gap-3 sm:grid-cols-3" aria-label="Identity evidence images">
                <EvidenceImage label="Front ID image" url={review.identity.frontImageUrl} />
                <EvidenceImage label="Back ID image" url={review.identity.backImageUrl} />
                <EvidenceImage label="Selfie image" url={review.identity.selfieImageUrl} />
              </div>
            ) : (
              <div className="flex gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <p>{review.identity.diditResult ? "Didit verification result is available for this exception." : "No additional Didit result was stored for this exception."}</p>
              </div>
            )}
          </section>

          <div className="grid gap-2 border-t pt-4">
            <Label htmlFor="identity-decision-note">Decision note</Label>
            <textarea
              id="identity-decision-note"
              value={note}
              onChange={(event) => { setNote(event.target.value); setNoteError(""); }}
              placeholder="Record the evidence and reason for this decision"
              rows={3}
              aria-invalid={Boolean(noteError)}
              aria-describedby={noteError ? "identity-decision-note-error" : undefined}
              className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {noteError ? <p id="identity-decision-note-error" role="alert" className="text-sm font-medium text-destructive">{noteError}</p> : null}
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="outline" onClick={() => requestDecision("RESUBMISSION")} disabled={isSaving}><RotateCcw aria-hidden="true" /> Request resubmission</Button>
            <Button type="button" variant="destructive" onClick={() => requestDecision("REJECT")} disabled={isSaving}><XCircle aria-hidden="true" /> Reject</Button>
            <Button type="button" onClick={() => requestDecision("APPROVE")} disabled={isSaving}><CheckCircle2 aria-hidden="true" /> Approve</Button>
          </div>
        </DialogContent>
      </Dialog>

      {pendingDecision && confirmation ? (
        <ConfirmActionModal
          isOpen
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={isSaving ? "Saving decision…" : confirmation.confirmLabel}
          cancelLabel="Go back"
          onCancel={() => setPendingDecision(null)}
          onConfirm={() => { void onDecide(pendingDecision, note.trim()); }}
        >
          <p><strong>Decision note:</strong> {note.trim()}</p>
        </ConfirmActionModal>
      ) : null}
    </>
  );
}

export default function AdminIdentityReviewQueue() {
  const identityReviews = useIdentityReviews();

  return (
    <section aria-labelledby="identity-review-queue-title">
      <Card className="shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b">
          <div>
            <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-5" aria-hidden="true" /></div>
            <CardTitle id="identity-review-queue-title" className="text-2xl">Identity review queue</CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">Manual registrations and Didit exceptions that require a human identity decision. Worker qualification is not reviewed here.</CardDescription>
          </div>
          <Badge variant={identityReviews.reviews.length > 0 ? "warning" : "secondary"}>{identityReviews.reviews.length} pending</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 p-5">
          {identityReviews.statusMessage ? <div role="status" className="rounded-lg border bg-primary/5 p-3 text-sm">{identityReviews.statusMessage}</div> : null}
          {identityReviews.error ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="size-5" aria-hidden="true" /><p className="min-w-0 flex-1">{identityReviews.error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => { void identityReviews.refresh(); }}><RefreshCw aria-hidden="true" /> Retry</Button>
            </div>
          ) : null}
          {identityReviews.isLoading ? <div role="status" className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Loading identity reviews…</div> : null}
          {!identityReviews.isLoading && !identityReviews.error && identityReviews.reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-5 text-center"><Images className="mx-auto size-6 text-muted-foreground" aria-hidden="true" /><p className="mt-2 font-semibold">No identity reviews waiting</p><p className="mt-1 text-sm text-muted-foreground">New manual submissions and Didit exceptions will appear here.</p></div>
          ) : null}
          {!identityReviews.isLoading && identityReviews.reviews.length > 0 ? (
            <ul className="grid gap-3">
              {identityReviews.reviews.map((review) => (
                <li key={review.id} className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200">{review.source === "MANUAL_UPLOAD" ? <FileCheck2 className="size-5" aria-hidden="true" /> : <ShieldCheck className="size-5" aria-hidden="true" />}</span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="break-all font-semibold">{review.email}</p><Badge variant="secondary">{review.accountType}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{review.identity.documentType} · {review.source === "MANUAL_UPLOAD" ? "Manual registration" : "Didit exception"}</p><p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{[review.location.city, review.location.province].filter(Boolean).join(", ") || "Location unavailable"}</span><span className="flex items-center gap-1"><CalendarClock className="size-3.5" aria-hidden="true" />Submitted {formatDate(review.submittedAt)}</span></p></div>
                  <Button type="button" variant="outline" onClick={() => identityReviews.setSelectedReview(review)}>Open review</Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {identityReviews.selectedReview ? (
        <IdentityReviewDialog
          key={identityReviews.selectedReview.id}
          review={identityReviews.selectedReview}
          isSaving={identityReviews.savingReviewId === identityReviews.selectedReview.id}
          onClose={() => identityReviews.setSelectedReview(null)}
          onDecide={identityReviews.decide}
        />
      ) : null}
    </section>
  );
}
