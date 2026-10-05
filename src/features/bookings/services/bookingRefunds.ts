import { supabase } from "@/integrations/supabase";

export async function getBookingRefunds(bookingId: string) {
  const { data, error } = await supabase.from("booking_refunds")
    .select("id, case_id, payment_attempt_id, amount, currency, status, provider_refund_id, updated_at")
    .eq("booking_id", bookingId).order("created_at", { ascending: true });
  if (error) throw new Error("Refund status could not be loaded. Retry to see the latest progress.");
  return data;
}
export type BookingRefund = Awaited<ReturnType<typeof getBookingRefunds>>[number];

export async function hasVerifiedRefundPayment(bookingId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_verified_refund_payment", { p_booking_id: bookingId });
  if (error) throw new Error("Payment verification could not be checked. Try again before requesting a refund review.");
  return data === true;
}

export async function requestCaseRefund(caseId: string) {
  const { error } = await supabase.rpc("request_booking_case_refund", { p_case_id: caseId });
  if (error) throw new Error("Refund review could not be requested. Check that the case is open and payment is verified.");
}

export async function processCaseRefunds(caseId: string, reason?: string, expectedAmount?: number) {
  const response: unknown = await supabase.functions.invoke<unknown>("process-booking-refunds", {
    body: { caseId, action: reason ? "approve" : "check", ...(reason ? { reason, expectedAmount } : {}) },
  });
  const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = record(response);
  const data = record(result.data);
  if (result.error || data.checked !== true) throw new Error("Refund verification is unavailable. The saved status is preserved; check again shortly.");
  return { checked: true, needsRetry: data.needsRetry === true, providerRejected: data.providerRejected === true,
    simulatedCount: typeof data.simulatedCount === "number" ? data.simulatedCount : 0 };
}
