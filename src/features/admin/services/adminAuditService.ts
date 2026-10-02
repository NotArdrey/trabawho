import { supabase } from "@/integrations/supabase";
import { requireAdminReadAccess } from "./adminAccess";
import type { AuditEntry, AuditFeed } from "../types/admin-activity";

const LIMIT = 500;
export async function fetchAdminAuditFeed(): Promise<AuditFeed> {
  await requireAdminReadAccess();
  const [bookings, support, identity] = await Promise.all([
    supabase.from("booking_audit_events").select("id, booking_id, actor_id, actor_role, event_type, reason, from_status, to_status, idempotency_key, created_at").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("booking_support_admin_actions").select("id, case_id, actor_id, action, target_party, reason, operation_id, created_at").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("identity_review_actions").select("id, review_id, actor_id, decision, reason, operation_id, created_at").order("created_at", { ascending: false }).limit(LIMIT),
  ]);
  const unavailable = [bookings.error && "Booking history", support.error && "Support follow-ups", identity.error && "Identity decisions"].filter((value): value is string => Boolean(value));
  if (unavailable.length === 3) throw new Error("Audit history could not be loaded. Check your connection and retry.");
  const supportRows = support.error ? [] : support.data || [];
  const supportOperations = new Set(supportRows.map((row) => row.operation_id));
  const entries: AuditEntry[] = [
    ...(bookings.error ? [] : bookings.data || []).filter((row) => row.event_type !== "admin_case_followup" || !row.idempotency_key || !supportOperations.has(row.idempotency_key)).map((row): AuditEntry => ({
      id: `booking-${row.id}`, source: "bookings", actorId: row.actor_id, actor: row.actor_role || "System", action: row.event_type.replaceAll("_", " "),
      target: row.booking_id, reason: row.reason || "", outcome: row.to_status ? `${row.from_status || "Previous status"} → ${row.to_status}` : "Recorded",
      createdAt: row.created_at, operationId: row.idempotency_key,
    })),
    ...supportRows.map((row): AuditEntry => ({ id: `support-${row.id}`, source: "support", actorId: row.actor_id, actor: "Admin", action: row.action.replaceAll("_", " "),
      target: row.case_id, reason: row.reason, outcome: row.target_party ? `Follow-up for ${row.target_party}` : "Follow-up recorded", createdAt: row.created_at, operationId: row.operation_id })),
    ...(identity.error ? [] : identity.data || []).map((row): AuditEntry => ({ id: `identity-${row.id}`, source: "identity", actorId: row.actor_id, actor: "Admin", action: "Identity review",
      target: row.review_id, reason: row.reason, outcome: row.decision === "APPROVED" ? "Approved" : "Declined", createdAt: row.created_at, operationId: row.operation_id })),
  ];
  const actorIds = [...new Set(entries.flatMap((row) => row.actorId ? [row.actorId] : []))];
  // Batch below URL-length limits; missing profiles do not erase immutable activity.
  for (let offset = 0; offset < actorIds.length; offset += 100) {
    const profiles = await supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds.slice(offset, offset + 100));
    if (profiles.error) { unavailable.push("Actor names"); break; }
    const names = new Map((profiles.data || []).map((profile) => [profile.user_id, profile.full_name]));
    for (const entry of entries) if (entry.actorId && names.get(entry.actorId)) entry.actor = names.get(entry.actorId) || entry.actor;
  }
  return { entries: entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)), unavailable,
    cappedSources: [bookings.data?.length === LIMIT && "Booking history", support.data?.length === LIMIT && "Support follow-ups", identity.data?.length === LIMIT && "Identity decisions"].filter((value): value is string => Boolean(value)) };
}
