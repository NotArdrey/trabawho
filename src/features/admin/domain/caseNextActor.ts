export interface CaseNextActorInput {
  status: string;
  policy_route: "rework_request" | "support_review";
  provider_response_action: "offer_rework" | "request_support_review" | null;
  rework_state: "appointment_proposed" | "appointment_accepted" | "rework_delivered" | "resolved_by_client" | "escalated" | null;
}

export function caseNextActor(item: CaseNextActorInput): "Provider" | "Client" | "Support review" | "No action needed" {
  if (item.status === "closed") return "No action needed";
  if (item.status === "under_review" || item.rework_state === "escalated") return "Support review";
  if (item.policy_route !== "rework_request") return "Support review";
  if (!item.provider_response_action || item.provider_response_action === "offer_rework" && !item.rework_state) return "Provider";
  if (item.rework_state === "appointment_proposed" || item.rework_state === "rework_delivered") return "Client";
  if (item.rework_state === "appointment_accepted") return "Provider";
  return "Support review";
}
