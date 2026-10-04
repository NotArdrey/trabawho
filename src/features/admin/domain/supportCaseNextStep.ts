import type { SupportCase } from "@/features/admin/services/adminSupportService";

export function supportCaseNextStep(item: SupportCase): string {
  if (item.pendingReviewCount) return "Further review requested · admin decision needed";
  if (item.status === "closed") return "Case closed";
  if (item.case_type === "provider_no_show") {
    if (item.escalated_at) return "Provider response overdue · admin decision needed";
    if (item.resolution_status === "awaiting_provider" && item.response_due_at && new Date(item.response_due_at).getTime() <= Date.now()) return "Provider reply overdue · support review needed";
    if (item.resolution_status === "awaiting_provider") return "Waiting for provider response";
    if (item.resolution_status === "awaiting_client") return "Waiting for client response";
    if (item.resolution_status === "replacement_proposed") return "Replacement visit needs both approvals";
    if (item.resolution_status === "replacement_accepted") return "Replacement visit accepted";
    if (item.resolution_status === "refund_pending") return "Refund pending provider verification";
    if (item.resolution_status === "refund_failed") return "Refund failed · support action needed";
  }
  if (item.refund_requested_at) return "Client requested refund review";
  switch (item.latestFollowup?.action) {
    case "refund_review_needed": return "Referred for refund review";
    case "request_information": return "Information needed for support review";
    case "reschedule_needed": return "Rescheduling recommended";
    case "rework_arranged": return "Rework arrangement recommended";
  }
  return item.status === "under_review" ? "Support review in progress"
    : item.policy_route === "rework_request" ? "Provider rework requested" : "Support review needed";
}
