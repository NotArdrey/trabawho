import { z } from "zod";

export const identityReviewSchema = z.object({
  id: z.string(), user_id: z.string(), submitted_by_email: z.string(),
  submitted_app_role: z.string().nullable(), document_type: z.string(), source: z.string(),
  status: z.enum(["PENDING_REVIEW", "APPROVED", "DECLINED"]), created_at: z.string(),
  expected_decision_by: z.string(), duplicate_reason: z.string().nullable(), duplicate_match_count: z.number(),
  reviewed_at: z.string().nullable(), review_notes: z.string().nullable(), decision_email_sent_at: z.string().nullable(),
  email_delivery_status: z.string(), email_delivery_error: z.string().nullable(),
  verified_full_legal_name: z.string().nullable(), didit_session_id: z.string().nullable(),
});
const reportSchema = z.object({
  status: z.string().nullable(), name: z.string().nullable(), expiry: z.string().nullable(),
  checks: z.array(z.object({ label: z.string(), status: z.string() })), warnings: z.array(z.string()),
});
export const identityDetailSchema = z.object({
  registration: z.object({ source_legal_name: z.string().nullable(), requested_legal_name: z.string().nullable(),
    name_issue: z.string().nullable(), reviewed_legal_name: z.string().nullable() }).nullable().optional(),
  review: identityReviewSchema,
  profile: z.object({ full_name: z.string(), email: z.string(), role: z.string(),
    province: z.string().nullable(), city: z.string().nullable(), barangay: z.string().nullable(), address: z.string().nullable(),
    verification_status: z.string(), id_document_expiry: z.string().nullable(), account_status: z.string(), is_verified: z.boolean(),
  }),
  history: z.array(z.object({ id: z.string(), decision: z.string(), reason: z.string(), created_at: z.string() })),
  images: z.array(z.object({ label: z.string(), url: z.string().url() })), warnings: z.array(z.string()),
  didit: reportSchema.nullable(),
});
export const identityPageSchema = z.object({ items: z.array(identityReviewSchema), total: z.number(), page: z.number(), pageSize: z.number() });
export const decisionResultSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED"]),
  emailDelivery: z.object({ sent: z.boolean(), required: z.boolean(), status: z.string() }).nullable(),
});
export type IdentityReview = z.infer<typeof identityReviewSchema>;
export type IdentityDetail = z.infer<typeof identityDetailSchema>;
export type IdentityReviewPage = z.infer<typeof identityPageSchema>;
export type IdentityDecision = "APPROVED" | "DECLINED";
export type IdentityFilter = IdentityReview["status"] | "all";
export interface IdentityQuery { page: number; status: IdentityFilter; search: string }

export function decisionValidation(reason: string, decision: IdentityDecision, evidenceReviewed: boolean): string {
  if (reason.trim().length < 20 || reason.trim().length > 2000) return "Explain the decision in 20 to 2000 characters.";
  if (decision === "APPROVED" && !evidenceReviewed) return "Confirm that you reviewed the identity evidence before approving.";
  return "";
}
