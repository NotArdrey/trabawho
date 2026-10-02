import type { Database, Json } from "@/integrations/supabase/database.types";

export type SellerRow = Database["public"]["Tables"]["sellers"]["Row"];
export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

export interface WorkerProfile {
  fullName?: string;
  full_name?: string;
  serviceType?: string;
  customServiceType?: string;
  bio?: string;
  description?: string;
  profilePhoto?: string;
  profile_photo?: string;
  address?: string;
  barangay?: string;
  city?: string;
  province?: string;
  location?: { address?: string; barangay?: string; city?: string; province?: string };
  pricingModel?: string;
  fixedPrice?: number | string | null;
  hourlyRate?: number | string | null;
  dailyRate?: number | string | null;
  weeklyRate?: number | string | null;
  monthlyRate?: number | string | null;
  projectRate?: number | string | null;
  rateBasis?: string;
  bookingMode?: string;
  paymentAdvance?: boolean;
  paymentAfterService?: boolean;
  afterServicePaymentType?: "both" | "cash-only" | "gcash-only";
  gcashNumber?: string;
}

export interface WorkerServiceInput {
  title: string;
  shortDescription?: string;
  description?: string;
  basePrice?: number | null;
  priceType?: string;
  currency?: string;
  durationMinutes?: number | null;
  metadata?: Json;
}
