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
      service_photos: Table<{ id: number; service_id: number; storage_path: string | null; public_url: string | null; caption: string | null; sort_order: number | null; created_at: string }>;
      portfolio_items: Table<{ id: number; seller_id: string; title: string | null; description: string | null; media: Json | null; created_at: string }>;
      seller_certifications: Table<{ id: number; seller_id: string; name: string; issuing_organization: string | null; issue_date: string | null; expiry_date: string | null; document_path: string | null; verified: boolean | null; created_at: string }>;
      seller_availability: Table<TimestampColumns & { id: number; seller_id: string; type: "recurring" | "oneoff" | "blocked"; day_of_week: number | null; start_time: string | null; end_time: string | null; start_date: string | null; end_date: string | null; timezone: string | null; notes: string | null }>;
      service_slots: Table<TimestampColumns & { id: number; service_id: number; seller_id: string; start_ts: string; end_ts: string; capacity: number | null; status: "available" | "booked" | "cancelled" }>;
      bookings: Table<TimestampColumns & { id: string; service_id: number; seller_id: string; buyer_id: string; slot_id: number | null; start_ts: string | null; end_ts: string | null; status: string; total_amount: number | null; currency: string | null; payment_reference: string | null; metadata: Json | null }>;
      conversations: Table<{ id: string; booking_id: string | null; seller_id: string | null; buyer_id: string | null; metadata: Json | null; created_at: string }>;
      messages: Table<{ id: string; conversation_id: string; sender_id: string; body: string | null; attachments: Json | null; read_by: Json | null; created_at: string }>;
      reviews: Table<TimestampColumns & { id: number; seller_id: string; reviewer_id: string; booking_id: string | null; rating: number; title: string | null; body: string | null; helpful_count: number | null; published: boolean | null }>;
      seller_rating_aggregates: Table<{ seller_id: string; avg_rating: number | null; rating_count: number | null; updated_at: string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
