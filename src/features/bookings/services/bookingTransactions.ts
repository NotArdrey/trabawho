import { supabase } from "@/integrations/supabase";
import type { Json } from "@/integrations/supabase";
import type {
  BookingRow,
  BookingTransitionResult,
  QuoteProposalResult,
  ReviewDecision,
} from "@/features/bookings/types/booking-transactions";

const operationId = (action: string) => {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${action}:${suffix}`;
};

const asRecord = (value: Json | undefined): Record<string, Json | undefined> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

const safeError = (message?: string) => {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("just booked") || normalized.includes("no longer available")) {
    return new Error("That time is no longer available. Choose another time to continue.");
  }
  if (normalized.includes("past")) return new Error("Choose a future date and time.");
  if (normalized.includes("own service")) return new Error("You cannot book your own service.");
  if (normalized.includes("permission") || normalized.includes("only the")) {
    return new Error("You do not have permission to complete this booking action.");
  }
  return new Error("We could not update this booking. Your existing details are unchanged.");
};

export async function createBookingRequest(serviceId: number, requestId = operationId("request")) {
  const { data, error } = await supabase.rpc("create_booking_request", {
    p_service_id: serviceId,
    p_operation_id: requestId,
  });
  if (error) throw safeError(error.message);
  return data;
}

export async function proposeBookingQuote(input: {
  amount: number;
  bookingId: string;
  endAt: string;
  operationId?: string;
  scopeSummary: string;
  startAt: string;
}): Promise<QuoteProposalResult> {
  const { data, error } = await supabase.rpc("propose_booking_quote", {
    p_booking_id: input.bookingId,
    p_amount: input.amount,
    p_start_ts: input.startAt,
    p_end_ts: input.endAt,
    p_scope_summary: input.scopeSummary,
    p_operation_id: input.operationId || operationId("quote"),
  });
  if (error) throw safeError(error.message);
  const result = asRecord(data);
  return result as unknown as QuoteProposalResult;
}

export async function rejectBookingQuote(input: {
  bookingId: string;
  quoteVersion: number;
  reason: string;
  operationId?: string;
}): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("reject_booking_quote", {
    p_booking_id: input.bookingId,
    p_quote_version: input.quoteVersion,
    p_reason: input.reason,
    p_operation_id: input.operationId || operationId("reject-quote"),
  });
  if (error) throw safeError(error.message);
  return data;
}

export async function cancelBooking(input: {
  bookingId: string;
  reason: string;
  operationId?: string;
}): Promise<BookingTransitionResult> {
  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: input.bookingId,
    p_reason: input.reason,
    p_operation_id: input.operationId || operationId("cancel"),
  });
  if (error) throw safeError(error.message);
  return asRecord(data) as unknown as BookingTransitionResult;
}

export async function rescheduleBooking(input: {
  bookingId: string;
  newSlotId: number;
  reason?: string;
  operationId?: string;
}): Promise<BookingTransitionResult> {
  const { data, error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: input.bookingId,
    p_new_slot_id: input.newSlotId,
    p_reason: input.reason || "",
    p_operation_id: input.operationId || operationId("reschedule"),
  });
  if (error) throw safeError(error.message);
  return asRecord(data) as unknown as BookingTransitionResult;
}

export async function reviewBookingCancellation(input: {
  bookingId: string;
  decision: ReviewDecision;
  reason?: string;
  operationId?: string;
}): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("review_booking_cancellation", {
    p_booking_id: input.bookingId,
    p_decision: input.decision,
    p_reason: input.reason || "",
    p_operation_id: input.operationId || operationId("review-cancel"),
  });
  if (error) throw safeError(error.message);
  return data;
}

export async function reviewBookingReschedule(input: {
  decision: ReviewDecision;
  reason?: string;
  requestId: string;
  operationId?: string;
}): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("review_booking_reschedule", {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_reason: input.reason || "",
    p_operation_id: input.operationId || operationId("review-reschedule"),
  });
  if (error) throw safeError(error.message);
  return data;
}
