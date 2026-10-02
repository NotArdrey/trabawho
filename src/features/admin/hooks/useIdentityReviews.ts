import { useEffect, useState } from "react";
import { getIdentityReview, listIdentityReviews } from "@/features/admin/services/adminIdentityService";
import type { IdentityDetail, IdentityQuery, IdentityReviewPage } from "@/features/admin/identity/types";

export function useIdentityReviews(query: IdentityQuery) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: IdentityReviewPage; error?: string }>({ key: "" });
  const key = JSON.stringify({ ...query, revision });
  const { page, status, search } = query;
  useEffect(() => {
    let current = true;
    void listIdentityReviews({ page, status, search }).then(
      (data) => { if (current) setResult({ key, data }); },
      (error: unknown) => { if (current) setResult({ key, error: error instanceof Error ? error.message : "Identity reviews could not be loaded." }); },
    );
    return () => { current = false; };
  }, [key, page, status, search]);
  return { data: result.key === key ? result.data : undefined, error: result.key === key ? result.error : undefined,
    loading: result.key !== key, refresh: () => setRevision((value) => value + 1) };
}

export function useIdentityReviewDetail(reviewId: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: IdentityDetail; error?: string }>({ key: "" });
  const key = `${reviewId}:${revision}`;
  useEffect(() => {
    let current = true;
    void getIdentityReview(reviewId).then(
      (data) => { if (current) setResult({ key, data }); },
      (error: unknown) => { if (current) setResult({ key, error: error instanceof Error ? error.message : "Review details could not be loaded." }); },
    );
    return () => { current = false; };
  }, [key, reviewId]);
  return { data: result.key === key ? result.data : undefined, error: result.key === key ? result.error : undefined,
    loading: result.key !== key, refresh: () => setRevision((value) => value + 1) };
}
