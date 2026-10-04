import { z } from "zod";
import { supabase } from "@/integrations/supabase";
import { decisionResultSchema, identityDetailSchema, identityPageSchema } from "@/features/admin/identity/types";
import type { IdentityDecision, IdentityQuery } from "@/features/admin/identity/types";

const errorSchema = z.object({ error: z.string() });
async function request(body: Record<string, unknown>): Promise<unknown> {
  const response = await supabase.functions.invoke<unknown>("account-admin-identity-review", { body });
  const error: unknown = response.error;
  if (error) {
    if (typeof error === "object" && "context" in error && error.context instanceof Response) {
      const payload: unknown = await error.context.json().catch(() => null);
      const safe = errorSchema.safeParse(payload);
      if (safe.success) throw new Error(safe.data.error);
    }
    throw new Error("Identity reviews could not be reached. Check your connection and retry.");
  }
  const rejection = errorSchema.safeParse(response.data);
  if (rejection.success) throw new Error(rejection.data.error);
  return response.data;
}
export async function listIdentityReviews(query: IdentityQuery) {
  return identityPageSchema.parse(await request({ action: "list", ...query }));
}
export async function getIdentityReview(reviewId: string) {
  return identityDetailSchema.parse(await request({ action: "detail", reviewId }));
}
export async function decideIdentityReview(input: {
  reviewId: string; decision: IdentityDecision; reason: string; evidenceReviewed: boolean; operationId: string; reviewedLegalName?: string;
}) {
  return decisionResultSchema.parse(await request({ action: "decide", ...input }));
}
export async function retryIdentityEmail(reviewId: string) {
  const schema = z.object({ emailDelivery: z.object({ sent: z.boolean(), required: z.boolean(), status: z.string() }) });
  return schema.parse(await request({ action: "retry_email", reviewId })).emailDelivery;
}
