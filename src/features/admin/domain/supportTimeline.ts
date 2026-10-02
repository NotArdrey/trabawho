import type { SupportAction, SupportCaseDetail } from "@/features/admin/services/adminSupportService";

export const supportActionLabels: Record<SupportAction, string> = {
  request_information: "Record information needed",
  rework_arranged: "Recommend rework arrangement",
  reschedule_needed: "Recommend rescheduling",
  refund_review_needed: "Refer for refund review",
};

export function supportTimeline(detail: Pick<SupportCaseDetail, "audit" | "caseActions" | "adminActions">) {
  const adminOperations = new Set(detail.adminActions.map((entry) => entry.operation_id));
  return [
    // The audit and action rows describe the same follow-up. Match the operation,
    // retaining audit entries when their corresponding action is unavailable.
    ...detail.audit.filter((entry) => entry.event_type !== "admin_case_followup"
      || !entry.idempotency_key || !adminOperations.has(entry.idempotency_key))
      .map((entry) => ({ id: `audit-${entry.id}`, at: entry.created_at, label: entry.event_type.replaceAll("_", " "), note: entry.reason })),
    ...detail.caseActions.map((entry) => ({ id: `case-${entry.id}`, at: entry.created_at, label: entry.action.replaceAll("_", " "), note: entry.note })),
    ...detail.adminActions.map((entry) => ({ id: `admin-${entry.id}`, at: entry.created_at, label: supportActionLabels[entry.action], note: entry.reason })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}
