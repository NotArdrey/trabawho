import type { SupportCase } from "@/features/admin/services/adminSupportService";

export function supportCaseNextStep(item: SupportCase): string {
  if (item.status === "closed") return "Case closed";
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
