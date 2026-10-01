import type { Database } from "@/integrations/supabase";

export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
export type PaymentPlan = "full" | "downpayment";
export type ReviewDecision = "approve" | "decline";

export interface BookingQuote {
  id: string;
  booking_id: string;
  version: number;
  amount: number;
  currency: "PHP";
  scope_summary: string;
  proposed_start_ts: string;
  proposed_end_ts: string;
  status: "proposed" | "accepted" | "rejected" | "superseded";
}

export interface BookingTransitionResult {
  booking: BookingRow;
  outcome?: "cancelled" | "review_required" | "rescheduled" | "approval_required" | "unchanged";
  requestId?: string;
}

export interface QuoteProposalResult {
  booking: BookingRow;
  quote: BookingQuote;
}
