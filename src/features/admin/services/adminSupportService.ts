import { supabase } from "@/integrations/supabase";
import type { Database } from "@/integrations/supabase/database.types";

export type SupportCase = Database["public"]["Tables"]["booking_support_cases"]["Row"];
export type SupportAction = Database["public"]["Tables"]["booking_support_admin_actions"]["Row"]["action"];
export type TargetParty = "client" | "provider" | "both";

export async function listSupportCases(): Promise<SupportCase[]> {
  const { data, error } = await supabase.from("booking_support_cases")
    .select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Support cases could not be loaded. Try refreshing.");
  return data;
}

export async function getSupportCaseDetail(item: SupportCase) {
  const [bookingResult, paymentsResult, auditResult, caseActionsResult, adminActionsResult, deliveryResult] = await Promise.all([
    supabase.from("bookings").select("id, buyer_id, seller_id, service_id, status, start_ts, end_ts, total_amount, currency, payment_reference, schedule_status, work_started_at").eq("id", item.booking_id).single(),
    supabase.from("payment_attempts").select("id, purpose, status, amount, currency, created_at, paid_at").eq("booking_id", item.booking_id).order("created_at", { ascending: true }),
    supabase.from("booking_audit_events").select("id, event_type, actor_role, reason, created_at").eq("booking_id", item.booking_id).order("created_at", { ascending: true }).limit(100),
    supabase.from("booking_case_actions").select("id, action, note, appointment_at, created_at").eq("case_id", item.id).order("created_at", { ascending: true }),
    supabase.from("booking_support_admin_actions").select("id, action, target_party, reason, created_at").eq("case_id", item.id).order("created_at", { ascending: true }),
    supabase.from("booking_delivery_evidence").select("id, checklist, explanation, storage_path, created_at").eq("booking_id", item.booking_id).order("created_at", { ascending: true }),
  ]);
  if (bookingResult.error || !bookingResult.data) throw new Error("The booking for this case could not be loaded.");
  const booking = bookingResult.data;
  const [peopleResult, serviceResult] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name, email").in("user_id", [booking.buyer_id, booking.seller_id]),
    supabase.from("services").select("id, title").eq("id", booking.service_id).maybeSingle(),
  ]);
  return {
    booking,
    people: peopleResult.data || [],
    service: serviceResult.data,
    payments: paymentsResult.data || [],
    audit: auditResult.data || [],
    caseActions: caseActionsResult.data || [],
    adminActions: adminActionsResult.data || [],
    delivery: deliveryResult.data || [],
    unavailable: [paymentsResult.error && "Payment attempts", auditResult.error && "Booking history",
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
