export type ProviderActionDestination = "work" | "messages" | "bookings";

export interface ProviderDashboardMetric {
  id: "inquiries" | "today" | "messages" | "earnings";
  label: string;
  value: string;
  detail: string;
}

export interface ProviderActionItem {
  id: string;
  priority: number;
  title: string;
  detail: string;
  status?: string;
  schedule?: string;
  amount?: string;
  bookingId?: string;
  destination: ProviderActionDestination;
}

export interface ProviderScheduleItem {
  id: string;
  service: string;
  client: string;
  schedule: string;
  status: string;
  bookingId: string;
}

export interface ProviderServiceHealth {
  totalListings: number;
  activeListings: number;
  availableSlots: number;
  rating: number | null;
  reviewCount: number;
  verificationStatus: string | null;
}

export interface ConfirmedEarningsSummary {
  amount: number;
  currency: string;
  bookingCount: number;
}

export interface ProviderDashboardSnapshot {
  providerName: string;
  hasProviderSetup: boolean;
  metrics: ProviderDashboardMetric[];
  actions: ProviderActionItem[];
  todaySchedule: ProviderScheduleItem[];
  nextAppointment: ProviderScheduleItem | null;
  serviceHealth: ProviderServiceHealth;
  confirmedEarnings: ConfirmedEarningsSummary;
  conversationIds: string[];
}
