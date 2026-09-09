import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import WorkPaymentQueues from "./WorkPaymentQueues";
import type { WorkPaymentTransaction } from "../types/payment";

const cashTransaction: WorkPaymentTransaction = {
  id: "cash-1",
  cashConfirmationQrId: "QR-001",
  cashConfirmationStatus: "pending-worker-review",
  clientName: "Joshua Santos",
  expectedCashAmount: 850,
  service: "Appliance Repair",
  submittedCashAmount: 850,
};

const baseProps = {
  cancelledTransactions: [],
  cashTransactions: [],
  cashView: "pending" as const,
  onApproveRefund: vi.fn(),
  onCashReview: vi.fn(),
  onCashViewChange: vi.fn(),
  refundTransactions: [],
  showCancelled: false,
  showCash: false,
  showRefunds: false,
};

describe("WorkPaymentQueues", () => {
  it("routes cash review and view-selection actions", async () => {
    const user = userEvent.setup();
    const onCashReview = vi.fn();
    const onCashViewChange = vi.fn();

    render(
      <WorkPaymentQueues
        {...baseProps}
        cashTransactions={[cashTransaction]}
        onCashReview={onCashReview}
        onCashViewChange={onCashViewChange}
        showCash
      />,
    );

    expect(screen.getByText("Pending review", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Submitted: ₱850 · Expected: ₱850")).toBeInTheDocument();

    await user.click(screen.getByTestId("cash-approve-cash-1"));
    await user.click(screen.getByRole("button", { name: "History" }));

    expect(onCashReview).toHaveBeenCalledWith(cashTransaction, "approve");
    expect(onCashViewChange).toHaveBeenCalledWith("history");
  });

  it("keeps empty refund and cancellation queues recognizable", () => {
    render(<WorkPaymentQueues {...baseProps} showCancelled showRefunds />);

    expect(screen.getByRole("heading", { name: "GCash refund queue" })).toBeInTheDocument();
    expect(screen.getByText("No refunds to review")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancelled cash bookings" })).toBeInTheDocument();
    expect(screen.getByText("No cancelled bookings")).toBeInTheDocument();
  });
});
