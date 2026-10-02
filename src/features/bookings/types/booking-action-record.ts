import type { BookingFunding } from "../utils/bookingPaymentGuard";

export interface BookingActionRecord extends BookingFunding {
  id: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  disputeStatus?: string;
  scheduleStatus?: string;
  scheduleVersion?: number;
  workStartedAt?: string | null;
  appointmentStartAt?: string | null;
  completedAt?: string | null;
  warrantyEligible?: boolean;
  warrantyPolicyCode?: string | null;
  warrantyDurationDays?: number | null;
  raw?: { booking?: { status?: string } };
}
