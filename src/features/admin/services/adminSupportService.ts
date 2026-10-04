import { supabase } from "@/integrations/supabase";
import type { Database } from "@/integrations/supabase/database.types";

export type SupportAction = Database["public"]["Tables"]["booking_support_admin_actions"]["Row"]["action"];
export type SupportCase = Database["public"]["Tables"]["booking_support_cases"]["Row"] & {
  latestFollowup?: { action: SupportAction; created_at: string };
  assignedAdminName?: string | null;
  pendingReviewCount?: number;
};
export type TargetParty = "client" | "provider" | "both";

export async function getCurrentAdminId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in again to manage support cases.");
  return data.user.id;
}

export async function getSupportCaseById(caseId: string): Promise<SupportCase | null> {
  const { data, error } = await supabase.from("booking_support_cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw new Error("This case could not be loaded. Check your connection and try again.");
  if (!data) return null;
  const reviews = await supabase.from("booking_case_review_requests").select("id")
    .eq("case_id", caseId).eq("status", "pending").limit(100);
  if (reviews.error && reviews.error.code !== "PGRST205") throw new Error("Case review requests could not be loaded. Try again.");
  return { ...data, pendingReviewCount: reviews.data?.length || 0 };
}

export async function claimSupportCase(caseId: string) {
  const result = await supabase.rpc("claim_booking_support_case", { p_case_id: caseId });
  if (result.error) throw new Error("This case could not be assigned. Refresh it to check who owns it.");
  return result.data;
}

export async function listSupportCases(): Promise<SupportCase[]> {
  const sweep = await supabase.rpc("escalate_overdue_booking_cases", {});
  if (sweep.error && sweep.error.code !== "PGRST202") throw new Error("Overdue cases could not be checked. Try refreshing.");
  const { data, error } = await supabase.from("booking_support_cases")
    .select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Support cases could not be loaded. Try refreshing.");
  const reviews = await supabase.from("booking_case_review_requests").select("case_id")
    .eq("status", "pending").limit(100);
  if (reviews.error && reviews.error.code !== "PGRST205") throw new Error("Further-review requests could not be loaded. Try refreshing.");
  const missingReviewIds = [...new Set((reviews.data || []).map((request) => request.case_id))]
    .filter((id) => !data.some((item) => item.id === id));
  const extra = missingReviewIds.length ? await supabase.from("booking_support_cases").select("*").in("id", missingReviewIds) : null;
  if (extra?.error) throw new Error("Cases awaiting further review could not be loaded.");
  const cases = [...data, ...(extra?.data || [])];
  if (!cases.length) return [];
  const followups = await supabase.from("booking_support_admin_actions")
    .select("case_id, action, created_at").in("case_id", cases.map((item) => item.id))
    .order("created_at", { ascending: false });
  if (followups.error) throw new Error("Support follow-up history could not be loaded. Try refreshing.");
  const assignedIds = [...new Set(cases.flatMap((item) => item.assigned_admin_id ? [item.assigned_admin_id] : []))];
  const owners = assignedIds.length ? await supabase.from("profiles").select("user_id, full_name").in("user_id", assignedIds) : null;
  if (owners?.error) throw new Error("Case ownership could not be loaded. Try refreshing.");
  return cases.map((item) => ({ ...item, latestFollowup: followups.data.find((action) => action.case_id === item.id),
    assignedAdminName: owners?.data?.find((owner) => owner.user_id === item.assigned_admin_id)?.full_name || null,
    pendingReviewCount: (reviews.data || []).filter((request) => request.case_id === item.id).length }));
}

export async function getSupportCaseDetail(item: SupportCase) {
  const [bookingResult, paymentsResult, auditResult, caseActionsResult, adminActionsResult, deliveryResult, messagesResult] = await Promise.all([
    supabase.from("bookings").select("id, buyer_id, seller_id, service_id, status, start_ts, end_ts, total_amount, currency, payment_reference, schedule_status, work_started_at").eq("id", item.booking_id).single(),
    supabase.from("payment_attempts").select("id, purpose, status, amount, currency, created_at, paid_at, payment_id, environment").eq("booking_id", item.booking_id).order("created_at", { ascending: true }),
    supabase.from("booking_audit_events").select("id, event_type, actor_role, reason, idempotency_key, created_at").eq("booking_id", item.booking_id).order("created_at", { ascending: true }).limit(100),
    supabase.from("booking_case_actions").select("id, action, note, appointment_at, created_at").eq("case_id", item.id).order("created_at", { ascending: true }),
    supabase.from("booking_support_admin_actions").select("id, action, target_party, reason, operation_id, created_at").eq("case_id", item.id).order("created_at", { ascending: true }),
    supabase.from("booking_delivery_evidence").select("id, checklist, explanation, storage_path, created_at").eq("booking_id", item.booking_id).order("created_at", { ascending: true }),
    supabase.from("booking_case_messages").select("id, author_role, audience, created_at").eq("case_id", item.id).order("created_at", { ascending: true }),
  ]);
  if (bookingResult.error || !bookingResult.data) throw new Error("The booking for this case could not be loaded.");
  const booking = bookingResult.data;
  const [peopleResult, serviceResult] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name, email").in("user_id", [booking.buyer_id, booking.seller_id, ...(item.assigned_admin_id ? [item.assigned_admin_id] : [])]),
    supabase.from("services").select("id, title").eq("id", booking.service_id).maybeSingle(),
  ]);
  const eventResult = paymentsResult.data?.length ? await supabase.from("payment_provider_events")
    .select("event_id, event_type, payment_attempt_id, livemode, status, processed_at")
    .in("payment_attempt_id", paymentsResult.data.map((payment) => payment.id)) : null;
  return {
    booking,
    people: peopleResult.data || [],
    service: serviceResult.data,
    payments: paymentsResult.data || [],
    providerEvents: eventResult?.data || [],
    audit: auditResult.data || [],
    caseActions: caseActionsResult.data || [],
    adminActions: adminActionsResult.data || [],
    delivery: deliveryResult.data || [],
    caseMessages: messagesResult.data || [],
    unavailable: [paymentsResult.error && "Payment attempts", item.case_type === "provider_no_show" && eventResult?.error && "Provider payment events", auditResult.error && "Booking history",
      caseActionsResult.error && "Rework history", adminActionsResult.error && "Support actions",
      deliveryResult.error && "Delivery evidence", peopleResult.error && "Participant names",
      serviceResult.error && "Service title"].filter((value): value is string => Boolean(value)),
  };
}

export type SupportCaseDetail = Awaited<ReturnType<typeof getSupportCaseDetail>>;

export async function recordSupportFollowup(input: {
  caseId: string;
  action: SupportAction;
  targetParty: TargetParty | null;
  reason: string;
  operationId: string;
}) {
  if (input.reason.trim().length < 20) throw new Error("Explain the follow-up in at least 20 characters.");
  const { data, error } = await supabase.rpc("record_booking_support_followup", {
    p_case_id: input.caseId, p_action: input.action,
    p_target_party: input.action === "request_information" ? input.targetParty : null,
    p_reason: input.reason.trim(), p_operation_id: input.operationId,
  });
  if (error) {
    if (error.code === "42501") throw new Error("Only an administrator may record case follow-up.");
    if (error.code === "23514") throw new Error("This case has changed or is closed. Refresh it before continuing.");
    throw new Error("The follow-up could not be saved. Check the case and try again.");
  }
  return data;
}

export async function openSupportEvidence(path: string) {
  const { data, error } = await supabase.storage.from("booking-evidence").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error("The private evidence image could not be opened.");
  return data.signedUrl;
}
