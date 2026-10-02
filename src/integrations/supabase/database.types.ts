export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type TimestampColumns = {
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<TimestampColumns & {
        user_id: string;
        first_name: string | null;
        middle_name: string | null;
        last_name: string | null;
        full_name: string;
        email: string;
        role: "client" | "worker" | "admin";
        account_status: "active" | "disabled" | "suspended";
        phone_number: string | null;
        profile_photo: string | null;
        bio: string | null;
        province: string | null;
        city: string | null;
        barangay: string | null;
        address: string | null;
        is_client: boolean;
        is_worker: boolean;
      }>;
      worker_profiles: Table<TimestampColumns & {
        user_id: string;
        service_type: string | null;
        custom_service_type: string | null;
        bio: string | null;
        pricing_model: string;
        fixed_price: number | null;
        booking_mode: string;
        rate_basis: string;
        verification_status: string;
      }>;
      sellers: Table<TimestampColumns & {
        user_id: string;
        display_name: string | null;
        headline: string | null;
        tagline: string | null;
        about: string | null;
        is_verified: boolean;
        verification_status: "pending" | "approved" | "rejected";
        response_time_minutes: number | null;
        languages: string[] | null;
        default_currency: string | null;
        business_hours: Json | null;
        search_meta: Json | null;
      }>;
      services: Table<TimestampColumns & {
        id: number;
        seller_id: string;
        title: string;
        slug: string;
        description: string | null;
        short_description: string | null;
        category_id: number | null;
        price_type: "fixed" | "hourly" | "custom" | "package";
        base_price: number | null;
        currency: string | null;
        duration_minutes: number | null;
        active: boolean;
        metadata: Json | null;
      }>;
      service_categories: Table<{ id: number; name: string; slug: string; parent_id: number | null }>;
      service_warranty_policies: Table<{ service_id: number; policy_code: "repair_workmanship_7d"; version: string; duration_days: number; coverage_summary: string; enabled: boolean; updated_at: string }>;
      service_photos: Table<{ id: number; service_id: number; storage_path: string | null; public_url: string | null; caption: string | null; sort_order: number | null; created_at: string }>;
      portfolio_items: Table<{ id: number; seller_id: string; title: string | null; description: string | null; media: Json | null; created_at: string }>;
      seller_certifications: Table<{ id: number; seller_id: string; name: string; issuing_organization: string | null; issue_date: string | null; expiry_date: string | null; document_path: string | null; verified: boolean | null; created_at: string }>;
      seller_availability: Table<TimestampColumns & { id: number; seller_id: string; type: "recurring" | "oneoff" | "blocked"; day_of_week: number | null; start_time: string | null; end_time: string | null; start_date: string | null; end_date: string | null; timezone: string | null; notes: string | null }>;
      service_slots: Table<TimestampColumns & { id: number; service_id: number; seller_id: string; start_ts: string; end_ts: string; capacity: number | null; metadata: Json | null; status: "available" | "booked" | "cancelled"; visibility: "public" | "booking_only" }>;
      bookings: Table<TimestampColumns & {
        id: string;
        service_id: number;
        seller_id: string;
        buyer_id: string;
        slot_id: number | null;
        start_ts: string | null;
        end_ts: string | null;
        status: string;
        total_amount: number | null;
        currency: string | null;
        payment_reference: string | null;
        metadata: Json | null;
        quote_status: "not_required" | "awaiting_quote" | "proposed" | "accepted" | "rejected";
        schedule_status: "unscheduled" | "proposed" | "held" | "confirmed" | "expired" | "reschedule_requested" | "released";
        hold_expires_at: string | null;
        balance_due_at: string | null;
        work_started_at: string | null;
        warranty_eligible: boolean;
        warranty_policy_code: string | null;
        warranty_policy_version: string | null;
        warranty_duration_days: number | null;
        warranty_coverage_summary: string | null;
        cancellation_status: "none" | "requested" | "approved" | "declined";
        cancellation_reason: string | null;
        cancellation_requested_at: string | null;
        cancellation_requested_by: string | null;
      }>;
      booking_quotes: Table<TimestampColumns & { id: string; booking_id: string; version: number; amount: number; currency: "PHP"; scope_summary: string; proposed_start_ts: string; proposed_end_ts: string; status: "proposed" | "accepted" | "rejected" | "superseded"; created_by: string; accepted_at: string | null; rejected_at: string | null; rejection_reason: string | null }>;
      booking_reschedule_requests: Table<TimestampColumns & { id: string; booking_id: string; requested_by: string; requested_slot_id: number; previous_slot_id: number | null; status: "pending" | "approved" | "declined" | "cancelled"; reason: string | null; reviewer_id: string | null; review_reason: string | null; reviewed_at: string | null; operation_id: string }>;
      payment_attempts: Table<{ id: string; booking_id: string; buyer_id: string; purpose: "initial" | "balance"; status: string; amount: number; currency: string; created_at: string; paid_at: string | null }>;
      booking_delivery_evidence: Table<{ id: string; booking_id: string; schedule_version: number; provider_id: string; checklist: string[]; explanation: string | null; storage_path: string | null; created_at: string }>;
      booking_support_cases: Table<{ id: string; booking_id: string; reporter_id: string; case_type: string; reason: string; storage_path: string | null; policy_route: "rework_request" | "support_review"; policy_reason: string | null; status: "open" | "under_review" | "closed"; created_at: string; closed_at: string | null; provider_response_action: "offer_rework" | "request_support_review" | null; provider_response_text: string | null; provider_response_storage_path: string | null; provider_responded_at: string | null; provider_responded_by: string | null; provider_response_operation_id: string | null }>;
      conversations: Table<{ id: string; booking_id: string | null; seller_id: string | null; buyer_id: string | null; metadata: Json | null; created_at: string }>;
      messages: Table<{ id: string; conversation_id: string; sender_id: string; body: string | null; attachments: Json | null; read_by: Json | null; created_at: string }>;
      reviews: Table<TimestampColumns & { id: number; seller_id: string; reviewer_id: string; booking_id: string | null; rating: number; title: string | null; body: string | null; helpful_count: number | null; published: boolean | null }>;
      seller_rating_aggregates: Table<{ seller_id: string; avg_rating: number | null; rating_count: number | null; updated_at: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      cancel_booking: { Args: { p_booking_id: string; p_reason: string; p_operation_id: string }; Returns: Json };
      create_booking_request: { Args: { p_service_id: number; p_operation_id: string }; Returns: Database["public"]["Tables"]["bookings"]["Row"] };
      propose_booking_quote: { Args: { p_booking_id: string; p_amount: number; p_start_ts: string; p_end_ts: string; p_scope_summary: string; p_operation_id: string }; Returns: Json };
      reject_booking_quote: { Args: { p_booking_id: string; p_quote_version: number; p_reason: string; p_operation_id: string }; Returns: Database["public"]["Tables"]["bookings"]["Row"] };
      reschedule_booking: { Args: { p_booking_id: string; p_new_slot_id: number; p_reason: string; p_operation_id: string }; Returns: Json };
      review_booking_cancellation: { Args: { p_booking_id: string; p_decision: string; p_reason: string; p_operation_id: string }; Returns: Database["public"]["Tables"]["bookings"]["Row"] };
      review_booking_reschedule: { Args: { p_request_id: string; p_decision: string; p_reason: string; p_operation_id: string }; Returns: Database["public"]["Tables"]["bookings"]["Row"] };
      start_booking_checkout: { Args: { p_booking_id?: string | null; p_service_id?: number | null; p_slot_id?: number | null; p_quote_version?: number | null; p_payment_plan?: string; p_operation_id?: string | null }; Returns: Json };
      start_booking_work: { Args: { p_booking_id: string; p_idempotency_key: string }; Returns: Database["public"]["Tables"]["bookings"]["Row"] };
      save_booking_delivery_evidence: { Args: { p_booking_id: string; p_checklist: string[]; p_explanation: string | null; p_storage_path: string | null }; Returns: Database["public"]["Tables"]["booking_delivery_evidence"]["Row"] };
      open_booking_support_case: { Args: { p_booking_id: string; p_case_type: string; p_reason: string; p_storage_path: string | null; p_idempotency_key: string }; Returns: Database["public"]["Tables"]["booking_support_cases"]["Row"] };
      respond_to_repair_claim: { Args: { p_case_id: string; p_action: "offer_rework" | "request_support_review"; p_response: string; p_storage_path: string | null; p_operation_id: string }; Returns: Database["public"]["Tables"]["booking_support_cases"]["Row"] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
