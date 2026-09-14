import type { AdminIdentityReview, IdentityReviewDecision } from "@/features/admin/types";
import { supabase } from "@/shared/services/supabaseClient";

interface FunctionError {
  message?: string;
}

interface FunctionResult {
  data: unknown;
  error: FunctionError | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isAdminIdentityReview(value: unknown): value is AdminIdentityReview {
  if (!isRecord(value) || !isRecord(value.location) || !isRecord(value.identity)) return false;
  return typeof value.id === "string"
    && typeof value.userId === "string"
    && typeof value.email === "string"
    && (value.accountType === "client" || value.accountType === "worker")
    && value.status === "PENDING_REVIEW";
}

async function invokeIdentityReviewFunction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await supabase.functions.invoke("manual-identity-review", { body }) as FunctionResult;
  if (result.error) throw new Error(result.error.message || "Identity reviews could not be reached.");
  if (!isRecord(result.data)) throw new Error("Identity reviews returned an invalid response.");
  if (result.data.success === false || typeof result.data.error === "string") {
    throw new Error(typeof result.data.error === "string" ? result.data.error : "Identity review request failed.");
  }
  return result.data;
}

export async function fetchIdentityReviews(): Promise<AdminIdentityReview[]> {
  const data = await invokeIdentityReviewFunction({ action: "list_identity_reviews" });
  if (!Array.isArray(data.reviews)) return [];
  return data.reviews.filter(isAdminIdentityReview);
}

export async function decideIdentityReview(input: {
  reviewId: string;
  decision: IdentityReviewDecision;
  note: string;
}): Promise<void> {
  await invokeIdentityReviewFunction({
    action: "decide_identity_review",
    reviewId: input.reviewId,
    decision: input.decision,
    note: input.note,
    redirectTo: `${window.location.origin}/sign-in`,
  });
}
