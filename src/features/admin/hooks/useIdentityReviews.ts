import { useCallback, useEffect, useState } from "react";

import { decideIdentityReview, fetchIdentityReviews } from "@/features/admin/services/identity-reviews";
import type { AdminIdentityReview, IdentityReviewDecision } from "@/features/admin/types";

function getSafeReviewError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/authentication|required|access/i.test(message)) return "Your administrator session cannot access identity reviews.";
  if (/network|fetch|reach/i.test(message)) return "Identity reviews could not be loaded. Check your connection and try again.";
  return message || "Identity reviews could not be loaded.";
}

export function useIdentityReviews() {
  const [reviews, setReviews] = useState<AdminIdentityReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<AdminIdentityReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const nextReviews = await fetchIdentityReviews();
      setReviews(nextReviews);
    } catch (requestError) {
      setReviews([]);
      setError(getSafeReviewError(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const decide = useCallback(async (decision: IdentityReviewDecision, note: string) => {
    if (!selectedReview) return;
    try {
      setSavingReviewId(selectedReview.id);
      setError("");
      await decideIdentityReview({ reviewId: selectedReview.id, decision, note });
      setReviews((current) => current.filter((review) => review.id !== selectedReview.id));
      setSelectedReview(null);
      setStatusMessage(
        decision === "APPROVE"
          ? "Identity approved. Account confirmation was started."
          : decision === "RESUBMISSION"
            ? "Resubmission requested. The user can provide new identity evidence."
            : "Identity review rejected.",
      );
    } catch (requestError) {
      setError(getSafeReviewError(requestError));
    } finally {
      setSavingReviewId(null);
    }
  }, [selectedReview]);

  return {
    reviews,
    selectedReview,
    setSelectedReview,
    isLoading,
    savingReviewId,
    error,
    statusMessage,
    refresh,
    decide,
  };
}
