import type { ServiceSearchParams } from "@/lib/service-search";

export type LandingSearchParams = ServiceSearchParams;

export interface LandingCategory {
  label: string;
  query?: string;
  description: string;
}

export interface LandingFeaturedService {
  id: string;
  title: string;
  providerName: string;
  serviceType: string;
  location?: string;
  photoUrl?: string;
  rating?: number;
  reviewCount?: number;
  priceLabel?: string;
  isVerified: boolean;
  availabilityLabel?: string;
}
