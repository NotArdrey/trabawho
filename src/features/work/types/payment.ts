export type CashConfirmationStatus = "approved" | "denied" | "pending-worker-review";
export type RefundStatus = "requested" | "approved" | "completed" | "approved-awaiting-client-confirmation";

export interface WorkPaymentTransaction {
  id: string | number;
  bookingStatus?: string;
  cancelPolicy?: string;
  cancelReason?: string;
  cashConfirmationQrId?: string;
  cashConfirmationStatus?: CashConfirmationStatus;
  clientName?: string;
  expectedCashAmount?: number;
  refundAmount?: number;
  refundReason?: string;
  refundReference?: string;
  refundStatus?: RefundStatus;
  service?: string;
  submittedCashAmount?: number;
  transactionId?: string;
  [key: string]: unknown;
}

export type CashPaymentView = "pending" | "history";
export type CashReviewDecision = "approve" | "deny";
