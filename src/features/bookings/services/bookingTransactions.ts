import { supabase } from "@/integrations/supabase";
import type { Json } from "@/integrations/supabase";
import { fetchBookingById, markBookingDelivered } from "@/features/bookings/services/bookingService";
import type { BookingRow, BookingTransitionResult, QuoteProposalResult, ReviewDecision } from "@/features/bookings/types/booking-transactions";

const operationId = (action: string) => {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${action}:${suffix}`;
};
const asRecord = (value: Json | undefined): Record<string, Json | undefined> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const safeError = (message?: string) => {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("quote has expired") || normalized.includes("proposed schedule is in the past")) return new Error("This quote has expired. Ask the provider for a new price and time.");
  if (normalized.includes("newer quote") || normalized.includes("quote is no longer available")) return new Error("This offer has changed. Review the latest quote before continuing.");
  if (normalized.includes("already has a booking") || normalized.includes("conflicts with another booking")) return new Error("The provider is already booked at that time. Choose another time before sending a quote.");
  if (normalized.includes("cannot receive a new quote") || normalized.includes("already has an active schedule or payment") || normalized.includes("cannot receive a quote response")) return new Error("This booking already has a schedule or payment, so its quote cannot be changed.");
  if (normalized.includes("cannot receive a quote")) return new Error("This request is no longer open for a quote.");
  if (normalized.includes("just booked") || normalized.includes("no longer available")) return new Error("That time is no longer available. Choose another time to continue.");
  if (normalized.includes("past")) return new Error("Choose a future date and time.");
  if (normalized.includes("own service")) return new Error("You cannot book your own service.");
  if (normalized.includes("permission") || normalized.includes("only the")) return new Error("You do not have permission to complete this booking action.");
  return new Error("We could not update this booking. Your existing details are unchanged.");
};

const quoteError = (error: { code?: string; message: string }) => {
  if (["PGRST202", "PGRST204", "42703", "42883"].includes(error.code || "")) {
    return new Error("Quotes are temporarily unavailable because the booking database needs an update. No quote was sent. Please contact support.");
  }
  const mapped = safeError(error.message);
  if (mapped.message.startsWith("We could not update")) {
    return new Error("We could not send this quote. Refresh the booking and try again; if it still fails, contact support with the booking reference.");
  }
  return mapped;
};

export async function createBookingRequest(serviceId: number, requestId = operationId("request")) {
  const { data, error } = await supabase.rpc("create_booking_request", { p_service_id: serviceId, p_operation_id: requestId });
  if (error) throw safeError(error.message);
  return data;
}

export async function proposeBookingQuote(input: { amount: number; bookingId: string; endAt: string; operationId?: string; scopeSummary: string; startAt: string }): Promise<QuoteProposalResult> {
  const { data, error } = await supabase.rpc("propose_booking_quote", { p_booking_id: input.bookingId, p_amount: input.amount, p_start_ts: input.startAt, p_end_ts: input.endAt, p_scope_summary: input.scopeSummary, p_operation_id: input.operationId || operationId("quote") });
  if (error) throw quoteError(error);
  return asRecord(data) as unknown as QuoteProposalResult;
}

export async function respondBookingQuote(input: { action: "request_changes" | "decline"; bookingId: string; feedback: string; quoteVersion: number; operationId?: string }): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("respond_booking_quote", {
    p_booking_id: input.bookingId, p_quote_version: input.quoteVersion,
    p_action: input.action, p_feedback: input.feedback,
    p_operation_id: input.operationId || operationId(`quote-${input.action}`),
  });
  if (error) throw quoteError(error);
  return data;
}

export async function rejectBookingQuote(input: { bookingId: string; quoteVersion: number; reason: string; operationId?: string }): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("reject_booking_quote", { p_booking_id: input.bookingId, p_quote_version: input.quoteVersion, p_reason: input.reason, p_operation_id: input.operationId || operationId("reject-quote") });
  if (error) throw safeError(error.message);
  return data;
}

export async function cancelBooking(input: { bookingId: string; reason: string; operationId?: string }): Promise<BookingTransitionResult> {
  const { data, error } = await supabase.rpc("cancel_booking", { p_booking_id: input.bookingId, p_reason: input.reason, p_operation_id: input.operationId || operationId("cancel") });
  if (error) throw safeError(error.message);
  return asRecord(data) as unknown as BookingTransitionResult;
}

export async function rescheduleBooking(input: { bookingId: string; newSlotId: number; reason?: string; operationId?: string }): Promise<BookingTransitionResult> {
  const { data, error } = await supabase.rpc("reschedule_booking", { p_booking_id: input.bookingId, p_new_slot_id: input.newSlotId, p_reason: input.reason || "", p_operation_id: input.operationId || operationId("reschedule") });
  if (error) throw safeError(error.message);
  return asRecord(data) as unknown as BookingTransitionResult;
}

export async function reviewBookingCancellation(input: { bookingId: string; decision: ReviewDecision; reason?: string; operationId?: string }): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("review_booking_cancellation", { p_booking_id: input.bookingId, p_decision: input.decision, p_reason: input.reason || "", p_operation_id: input.operationId || operationId("review-cancel") });
  if (error) throw safeError(error.message);
  return data;
}

export async function reviewBookingReschedule(input: { decision: ReviewDecision; reason?: string; requestId: string; operationId?: string }): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("review_booking_reschedule", { p_request_id: input.requestId, p_decision: input.decision, p_reason: input.reason || "", p_operation_id: input.operationId || operationId("review-reschedule") });
  if (error) throw safeError(error.message);
  return data;
}

export type BookingCaseType = "provider_no_show" | "client_no_show" | "delivery_issue" | "warranty_issue" | "service_issue";
export type RepairClaimResponse = "offer_rework" | "request_support_review";
export type RepairReworkAction = "propose_appointment" | "accept_appointment" | "escalate" | "submit_rework" | "confirm_rework";

const bucket = "booking-evidence";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function bookingOperationId(action: string, bookingId: string, version = 1): string {
  return `${action}:${bookingId}:schedule:${version}`;
}

async function uploadEvidenceImage(bookingId: string, image?: File | null): Promise<string | null> {
  if (!image) return null;
  if (!imageTypes.has(image.type) || image.size > 5 * 1024 * 1024) {
    throw new Error("Choose a JPEG, PNG, or WebP image smaller than 5 MB.");
  }
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user) throw new Error("Sign in before submitting evidence.");
  const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
  const path = `${bookingId}/${identity.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, image, { contentType: image.type, upsert: false });
  if (error) throw new Error("The image could not be uploaded. Please try again.");
  return path;
}

export async function startBookingWork(bookingId: string, version = 1): Promise<unknown> {
  const { error } = await supabase.rpc("start_booking_work", {
    p_booking_id: bookingId,
    p_idempotency_key: bookingOperationId("start-work", bookingId, version),
  });
  if (error) throw new Error(error.message);
  return fetchBookingById(bookingId);
}

export async function deliverBookingWithEvidence(
  bookingId: string,
  version: number,
  checklist: string[],
  explanation: string,
  image?: File | null,
): Promise<unknown> {
  if (checklist.length < 2) throw new Error("Complete the work and handover checklist.");
  if (!image && explanation.trim().length < 20) throw new Error("Add a photo or at least 20 characters of work notes.");
  const path = await uploadEvidenceImage(bookingId, image);
  const { error } = await supabase.rpc("save_booking_delivery_evidence", {
    p_booking_id: bookingId,
    p_checklist: checklist,
    p_explanation: explanation.trim() || null,
    p_storage_path: path,
  });
  if (error) throw new Error(error.message);
  await markBookingDelivered(bookingId, { idempotencyKey: bookingOperationId("deliver", bookingId, version) });
  return fetchBookingById(bookingId);
}

export async function openBookingSupportCase(
  bookingId: string,
  caseType: BookingCaseType,
  reason: string,
  image?: File | null,
): Promise<{ booking: unknown; policyRoute: "rework_request" | "support_review" }> {
  if (reason.trim().length < 20) throw new Error("Describe the issue in at least 20 characters.");
  const path = await uploadEvidenceImage(bookingId, image);
  const { data, error } = await supabase.rpc("open_booking_support_case", {
    p_booking_id: bookingId,
    p_case_type: caseType,
    p_reason: reason.trim(),
    p_storage_path: path,
    p_idempotency_key: `case:${bookingId}:${caseType}`,
  });
  if (error) throw new Error(error.message);
  return { booking: await fetchBookingById(bookingId), policyRoute: data.policy_route };
}

export async function getBookingSupportCase(bookingId: string, caseId?: string) {
  const fields = "id, case_type, reason, policy_route, policy_reason, status, created_at, provider_response_action, provider_response_text, provider_responded_at, rework_state, rework_appointment_at, rework_evidence_note, rework_delivered_at, rework_confirmed_at, rework_escalated_at";
  const query = supabase.from("booking_support_cases")
    .select(`${fields}, refund_requested_at, latest_support_action, latest_support_target, latest_support_at, resolution_status`)
    .eq("booking_id", bookingId);
  if (caseId) query.eq("id", caseId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  // Keep existing case history available during a staged database rollout.
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const fallbackQuery = supabase.from("booking_support_cases").select(fields).eq("booking_id", bookingId);
    if (caseId) fallbackQuery.eq("id", caseId);
    const fallback = await fallbackQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (fallback.error) throw new Error("The booking report could not be loaded.");
    return fallback.data ? { ...fallback.data, refund_requested_at: null, latest_support_action: null, latest_support_target: null, latest_support_at: null, resolution_status: null } : null;
  }
  if (error) throw new Error("The booking report could not be loaded.");
  return data;
}

export async function respondToRepairClaim(
  bookingId: string, caseId: string, action: RepairClaimResponse, response: string,
): Promise<unknown> {
  if (response.trim().length < 20) throw new Error("Explain your response in at least 20 characters.");
  const { error } = await supabase.rpc("respond_to_repair_claim", {
    p_case_id: caseId,
    p_action: action,
    p_response: response.trim(),
    p_storage_path: null,
    p_operation_id: `repair-response:${caseId}`,
  });
  if (error) throw new Error(error.message);
  return fetchBookingById(bookingId);
}

export async function advanceRepairRework(input: {
  bookingId: string;
  caseId: string;
  action: RepairReworkAction;
  note?: string;
  appointmentAt?: string;
}): Promise<{ booking: unknown; case: Awaited<ReturnType<typeof getBookingSupportCase>> }> {
  const note = input.note?.trim() || null;
  if (["submit_rework", "escalate"].includes(input.action) && (!note || note.length < 20)) {
    throw new Error("Describe the work or reason in at least 20 characters.");
  }
  if (input.action === "propose_appointment" && (!input.appointmentAt || !Number.isFinite(Date.parse(input.appointmentAt)))) {
    throw new Error("Choose a valid date and time for the return visit.");
  }
  const { data, error } = await supabase.rpc("advance_repair_rework", {
    p_case_id: input.caseId,
    p_action: input.action,
    p_note: note,
    p_appointment_at: input.appointmentAt || null,
    p_storage_path: null,
    p_operation_id: `rework:${input.caseId}:${input.action}`,
  });
  if (error) {
    if (error.code === "42501") throw new Error("This action is not available to your account.");
    if (error.code === "23505") throw new Error("This case has a different saved action. Refresh bookings to see the latest state.");
    if (error.code === "23514") throw new Error("The case or appointment has changed. Refresh bookings and check the next step.");
    throw new Error("Could not save this case action. Please try again.");
  }
  return { booking: await fetchBookingById(input.bookingId), case: data };
}

export async function getBookingDeliveryEvidence(bookingId: string, scheduleVersion: number) {
  const { data, error } = await supabase.from("booking_delivery_evidence")
    .select("checklist, explanation, storage_path, created_at")
    .eq("booking_id", bookingId).eq("schedule_version", scheduleVersion).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  let imageUrl: string | null = null;
  if (data.storage_path) {
    const signed = await supabase.storage.from(bucket).createSignedUrl(data.storage_path, 300);
    if (!signed.error) imageUrl = signed.data.signedUrl;
  }
  return { ...data, imageUrl };
}
