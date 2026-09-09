import { Ban, CircleDollarSign, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowEmptyState, WorkflowPanel } from "@/components/ui/workflow-panel";
import { cn } from "@/lib/utils";

import type {
  CashPaymentView,
  CashReviewDecision,
  WorkPaymentTransaction,
} from "../types/payment";

interface WorkPaymentQueuesProps {
  cancelledTransactions: readonly WorkPaymentTransaction[];
  cashTransactions: readonly WorkPaymentTransaction[];
  cashView: CashPaymentView;
  onApproveRefund: (transactionId: string | number) => unknown;
  onCashReview: (transaction: WorkPaymentTransaction, decision: CashReviewDecision) => void;
  onCashViewChange: (view: CashPaymentView) => void;
  refundTransactions: readonly WorkPaymentTransaction[];
  showCancelled: boolean;
  showCash: boolean;
  showRefunds: boolean;
}

const formatAmount = (amount?: number) => `₱${Number(amount || 0).toLocaleString("en-PH")}`;

function QueueList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border">{children}</ul>;
}

function QueueRow({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "refund" | "cancelled" }) {
  return (
    <li className={cn(
      "grid gap-3 px-4 py-4 sm:px-5",
      tone === "refund" && "bg-primary/[0.025]",
      tone === "cancelled" && "bg-destructive/[0.025]",
    )}>
      {children}
    </li>
  );
}

function QueueHeading({ children, status }: { children: React.ReactNode; status: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-foreground">{children}</strong>{status}</div>;
}

function CashStatus({ status }: { status?: string }) {
  if (status === "approved") return <Badge variant="success">Approved</Badge>;
  if (status === "denied") return <Badge variant="destructive">Denied</Badge>;
  return <Badge variant="brand">Pending review</Badge>;
}

function RefundStatusBadge({ status }: { status?: string }) {
  if (status === "completed" || status === "approved") return <Badge variant="success">Refund completed</Badge>;
  if (status === "approved-awaiting-client-confirmation") return <Badge variant="brand">Awaiting client confirmation</Badge>;
  return <Badge variant="warning">Refund requested</Badge>;
}

export default function WorkPaymentQueues({
  cancelledTransactions,
  cashTransactions,
  cashView,
  onApproveRefund,
  onCashReview,
  onCashViewChange,
  refundTransactions,
  showCancelled,
  showCash,
  showRefunds,
}: WorkPaymentQueuesProps) {
  return (
    <>
      {showCash && (
        <WorkflowPanel className="mb-4" data-testid="work-cash-section" icon={CircleDollarSign} title="Cash confirmations" description="Review cash payments submitted through your confirmation QR." tone="success" status={<Badge variant={cashTransactions.length ? "brand" : "secondary"}>{cashTransactions.length}</Badge>}>
          <div className="flex gap-1 border-b border-border p-3" aria-label="Cash confirmation view">
            <Button type="button" size="sm" variant={cashView === "pending" ? "primary" : "ghost"} aria-pressed={cashView === "pending"} onClick={() => onCashViewChange("pending")}>Pending review</Button>
            <Button type="button" size="sm" variant={cashView === "history" ? "primary" : "ghost"} aria-pressed={cashView === "history"} onClick={() => onCashViewChange("history")}>History</Button>
          </div>
          {cashTransactions.length === 0 ? (
            <WorkflowEmptyState className="min-h-32" icon={CircleDollarSign} title={cashView === "pending" ? "No requests to review" : "No completed transactions"} description={cashView === "pending" ? "New cash confirmation requests for this week will appear here." : "Approved or denied cash confirmations will appear here."} tone="success" />
          ) : (
            <QueueList>
              {cashTransactions.map((transaction) => (
                <QueueRow key={`confirm-${transaction.id}`}>
                  <QueueHeading status={<CashStatus status={transaction.cashConfirmationStatus} />}>{transaction.clientName || "Client"}</QueueHeading>
                  <p className="text-sm font-semibold text-foreground">{transaction.service || "Service"}</p>
                  <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div><dt className="sr-only">QR reference</dt><dd>QR ref: {transaction.cashConfirmationQrId || "N/A"}</dd></div>
                    <div><dt className="sr-only">Amounts</dt><dd>Submitted: {formatAmount(transaction.submittedCashAmount)} · Expected: {formatAmount(transaction.expectedCashAmount)}</dd></div>
                  </dl>
                  <p className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">{transaction.transactionId ? `Transaction ID: ${transaction.transactionId}` : "Transaction ID: Pending approval"}</p>
                  {cashView === "pending" && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button type="button" size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" data-testid={`cash-approve-${transaction.id}`} onClick={() => onCashReview(transaction, "approve")} disabled={transaction.cashConfirmationStatus === "approved"}>Approve</Button>
                      <Button type="button" size="sm" variant="destructive" data-testid={`cash-deny-${transaction.id}`} onClick={() => onCashReview(transaction, "deny")} disabled={transaction.cashConfirmationStatus === "denied"}>Deny</Button>
                    </div>
                  )}
                </QueueRow>
              ))}
            </QueueList>
          )}
        </WorkflowPanel>
      )}

      {showRefunds && (
        <WorkflowPanel className="mb-4" data-testid="work-refund-section" icon={RotateCcw} title="GCash refund queue" description="Track refund cases that require provider or client confirmation." tone="primary" status={<Badge variant={refundTransactions.length ? "warning" : "secondary"}>{refundTransactions.length}</Badge>}>
          {refundTransactions.length === 0 ? (
            <WorkflowEmptyState className="min-h-32" icon={RotateCcw} title="No refunds to review" description="Refund cases for this week will appear here when action is required." tone="primary" />
          ) : (
            <QueueList>
              {refundTransactions.map((transaction) => (
                <QueueRow key={`refund-${transaction.id}`} tone="refund">
                  <QueueHeading status={<RefundStatusBadge status={transaction.refundStatus} />}>{transaction.clientName || "Client"}</QueueHeading>
                  <p className="text-sm font-semibold text-primary">{transaction.service || "Service"}</p>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p>Amount: {formatAmount(transaction.refundAmount)}</p>
                    <p>Reason: {transaction.refundReason || "Service cancellation/refund case"}</p>
                    <p className="font-mono font-semibold text-primary">{transaction.refundReference ? `Refund ref: ${transaction.refundReference}` : "Refund ref: Pending"}</p>
                    <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{transaction.transactionId ? `Transaction ID: ${transaction.transactionId}` : "Transaction ID: N/A"}</p>
                  </div>
                  {transaction.refundStatus === "requested" && <div><Button type="button" size="sm" data-testid={`refund-approve-${transaction.id}`} onClick={() => onApproveRefund(transaction.id)}>Approve refund</Button></div>}
                </QueueRow>
              ))}
            </QueueList>
          )}
        </WorkflowPanel>
      )}

      {showCancelled && (
        <WorkflowPanel className="mb-4" data-testid="work-cancelled-section" icon={Ban} title="Cancelled cash bookings" description="Review cancelled cash bookings that do not require a GCash refund." status={<Badge variant="secondary">{cancelledTransactions.length}</Badge>}>
          {cancelledTransactions.length === 0 ? (
            <WorkflowEmptyState className="min-h-32" icon={Ban} title="No cancelled bookings" description="Cancelled cash bookings for this week will appear here." />
          ) : (
            <QueueList>
              {cancelledTransactions.map((transaction) => (
                <QueueRow key={`cancelled-${transaction.id}`} tone="cancelled">
                  <QueueHeading status={<Badge variant="destructive">Cancelled</Badge>}>{transaction.clientName || "Client"}</QueueHeading>
                  <p className="text-sm font-semibold text-destructive">{transaction.service || "Service"}</p>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p>Payment channel: Cash — no GCash refund needed</p>
                    <p>Reason: {transaction.cancelReason || "Cancelled before service."}</p>
                    <p className="font-semibold text-destructive">{transaction.cancelPolicy || "Cash-only cancellation flow"}</p>
                  </div>
                </QueueRow>
              ))}
            </QueueList>
          )}
        </WorkflowPanel>
      )}
    </>
  );
}

export type { WorkPaymentQueuesProps };
