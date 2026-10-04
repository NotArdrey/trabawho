import { useRef, useState } from "react";
import { decideIdentityReview, retryIdentityEmail } from "@/features/admin/services/adminIdentityService";
import { decisionValidation } from "@/features/admin/identity/types";
import type { IdentityDecision } from "@/features/admin/identity/types";

export function useIdentityReviewDecision(reviewId: string, refresh: () => void, onSaved: () => void, requireLegalName = false) {
  const [reason, setReason] = useState("");
  const [evidenceReviewed, setEvidenceReviewed] = useState(false);
  const [confirmation, setConfirmation] = useState<IdentityDecision | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewedLegalName, setReviewedLegalName] = useState('');
  const operation = useRef<{ key: string; id: string } | null>(null);

  const prepareDecision = (decision: IdentityDecision) => {
    const issue = decision === 'APPROVED' && requireLegalName && reviewedLegalName.trim().length < 2
      ? 'Record the complete legal name verified from the evidence.' : decisionValidation(reason, decision, evidenceReviewed);
    setError(issue);
    if (!issue) setConfirmation(decision);
  };
  const submit = async () => {
    if (!confirmation || saving) return;
    const key = `${confirmation}:${reason.trim()}:${reviewedLegalName.trim()}`;
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    setSaving(true); setError("");
    try {
      const result = await decideIdentityReview({ reviewId, decision: confirmation, reason: reason.trim(), evidenceReviewed, operationId: operation.current.id, reviewedLegalName });
      setConfirmation(null);
      setMessage(result.status === "DECLINED" ? "Identity rejected. Account access remains blocked."
        : result.emailDelivery?.status === "failed" ? "Identity approved. Email delivery failed; use Retry confirmation email."
        : result.emailDelivery?.required ? "Identity approved. The user must confirm their email before signing in." : "Identity approved. Email is already confirmed.");
      refresh(); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The decision could not be saved."); }
    finally { setSaving(false); }
  };
  const retryEmail = async () => {
    setSaving(true); setError("");
    try {
      const delivery = await retryIdentityEmail(reviewId);
      setMessage(delivery.sent ? "Confirmation email sent." : delivery.status === "rate_limited" ? "Wait one minute before requesting another confirmation email." : delivery.required ? "Email delivery is pending. Refresh to check the result." : "Email is already confirmed.");
      if (delivery.status === "failed") setError("Confirmation email could not be sent. Check the mail configuration and retry.");
      refresh(); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Email could not be sent."); }
    finally { setSaving(false); }
  };

  return { reason, setReason, reviewedLegalName, setReviewedLegalName, evidenceReviewed, setEvidenceReviewed, confirmation, setConfirmation, saving, error, message, prepareDecision, submit, retryEmail };
}
