import type { WorkPaymentTransaction } from "../types/payment";

// Match the Completed tab, including services stopped through the booking lifecycle.
const COMPLETED_STATUSES = new Set(["Completed Service", "Service Stopped"]);

export function countCompletedBookings(
  transactions: readonly Pick<WorkPaymentTransaction, "bookingStatus">[],
): number {
  return transactions.filter((transaction) => COMPLETED_STATUSES.has(transaction.bookingStatus ?? "")).length;
}
