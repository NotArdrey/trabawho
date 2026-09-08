export type BookingHubScope = "incoming" | "purchases";

export type BookingHubFilter =
  | "all"
  | "active"
  | "action-needed"
  | "scheduled"
  | "payment-due"
  | "delivered"
  | "completed"
  | "refunds"
  | "cancelled";

export interface BookingHubSummary {
  total: number;
  active: number;
  completed: number;
  actionNeeded: number;
}

export interface BookingCounterpartPresentation {
  id: string;
  name: string;
  role: "client" | "provider";
  photoUrl?: string | null;
}
