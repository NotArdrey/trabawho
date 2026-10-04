import { supabase } from "@/integrations/supabase";
import type { Database } from "@/integrations/supabase/database.types";

export type CaseMessage = Database["public"]["Tables"]["booking_case_messages"]["Row"];
export type CaseNotice = Database["public"]["Tables"]["booking_case_notifications"]["Row"];
export type ReplacementVisit = Database["public"]["Tables"]["booking_case_replacement_visits"]["Row"];
export type CaseReviewRequest = Database["public"]["Tables"]["booking_case_review_requests"]["Row"];
export type CaseAudience = CaseMessage["audience"];

export async function getCaseConversation(caseId: string) {
  const [messages, notifications, visits] = await Promise.all([
    supabase.from("booking_case_messages").select("*").eq("case_id", caseId).order("created_at"),
    supabase.from("booking_case_notifications").select("*").eq("case_id", caseId).is("read_at", null),
    supabase.from("booking_case_replacement_visits").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
  ]);
  if (messages.error || notifications.error || visits.error) throw new Error("Case updates could not be loaded. Try again.");
  return { messages: messages.data, notifications: notifications.data, visits: visits.data };
}

export async function sendCaseMessage(input: {
  caseId: string; audience: CaseAudience; body: string; bookingId: string; image?: File | null; operationId: string;
}) {
  let path: string | null = null;
  if (input.image) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(input.image.type) || input.image.size > 5 * 1024 * 1024)
      throw new Error("Choose a JPEG, PNG, or WebP image smaller than 5 MB.");
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) throw new Error("Sign in again before sending your update.");
    const extension = input.image.type === "image/png" ? "png" : input.image.type === "image/webp" ? "webp" : "jpg";
    path = `${input.bookingId}/${auth.data.user.id}/case/${input.operationId}.${extension}`;
    const upload = await supabase.storage.from("booking-evidence").upload(path, input.image, { contentType: input.image.type, upsert: false });
    if (upload.error && !upload.error.message.toLowerCase().includes("already exists")) throw new Error("The evidence photo could not be uploaded. Try again.");
  }
  const result = await supabase.rpc("send_booking_case_message", {
    p_case_id: input.caseId, p_audience: input.audience, p_body: input.body.trim(),
    p_storage_path: path, p_operation_id: input.operationId,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function markCaseRead(caseId: string) {
  const result = await supabase.rpc("mark_booking_case_notifications_read", { p_case_id: caseId });
  if (result.error) throw new Error("Updates were loaded but could not be marked read.");
}

export async function proposeReplacement(caseId: string, slotId: number, reason: string) {
  const result = await supabase.rpc("propose_booking_case_replacement", { p_case_id: caseId, p_slot_id: slotId, p_reason: reason.trim() });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function respondReplacement(visitId: string, accept: boolean) {
  const result = await supabase.rpc("respond_booking_case_replacement", { p_visit_id: visitId, p_accept: accept });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function startReplacement(visitId: string) {
  const result = await supabase.rpc("start_booking_case_replacement", { p_visit_id: visitId });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function deliverReplacement(visitId: string, bookingId: string, note: string, image?: File | null) {
  let path: string | null = null;
  if (image) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 5 * 1024 * 1024)
      throw new Error("Choose a JPEG, PNG, or WebP image smaller than 5 MB.");
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) throw new Error("Sign in again before uploading evidence.");
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    path = `${bookingId}/${auth.data.user.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("booking-evidence").upload(path, image, { contentType: image.type, upsert: false });
    if (upload.error) throw new Error("The evidence photo could not be uploaded. Try again.");
  }
  const result = await supabase.rpc("deliver_booking_case_replacement", { p_visit_id: visitId, p_note: note.trim(), p_storage_path: path });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function confirmReplacement(visitId: string) {
  const result = await supabase.rpc("confirm_booking_case_replacement", { p_visit_id: visitId });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listReplacementSlots(serviceId: number, providerId: string) {
  const result = await supabase.from("service_slots").select("id, start_ts, end_ts, capacity, status")
    .eq("service_id", serviceId).eq("seller_id", providerId).eq("status", "available")
    .gt("start_ts", new Date().toISOString()).order("start_ts").limit(40);
  if (result.error) throw new Error("Available times could not be loaded. Try again.");
  return result.data;
}

export async function getLatestReplacement(caseId: string) {
  const visits = await supabase.from("booking_case_replacement_visits").select("*")
    .eq("case_id", caseId).order("created_at", { ascending: false }).limit(1);
  if (visits.error) throw new Error("Replacement visit could not be loaded. Try again.");
  const visit = visits.data[0];
  if (!visit) return null;
  const slot = await supabase.from("service_slots").select("id, start_ts, end_ts")
    .eq("id", visit.slot_id).maybeSingle();
  if (slot.error) throw new Error("Replacement time could not be loaded. Try again.");
  return { visit, slot: slot.data };
}

export async function getCaseReviewRequests(caseId: string): Promise<CaseReviewRequest[]> {
  const result = await supabase.from("booking_case_review_requests").select("*")
    .eq("case_id", caseId).order("created_at", { ascending: false });
  if (result.error) throw new Error("Review requests could not be loaded. Try again.");
  return result.data;
}

export async function requestCaseReview(caseId: string, reason: string) {
  const result = await supabase.rpc("request_booking_case_review", { p_case_id: caseId, p_reason: reason.trim() });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function decideCaseReview(requestId: string, decision: "upheld" | "reopened", reason: string) {
  const result = await supabase.rpc("decide_booking_case_review", { p_request_id: requestId, p_decision: decision, p_reason: reason.trim() });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function openCaseImage(path: string) {
  const result = await supabase.storage.from("booking-evidence").createSignedUrl(path, 300);
  if (result.error || !result.data?.signedUrl) throw new Error("This private image could not be opened.");
  return result.data.signedUrl;
}
