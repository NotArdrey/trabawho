import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PaymentModal from "./PaymentModal";

const booking = {
  id: "booking-1",
  workerName: "Ramon De Leon Torres",
  serviceType: "Garden Cleanup & Yard Work",
  quoteAmount: 950,
  selectedSlot: { date: "2026-09-28", timeBlock: { startTime: "21:00" } },
};

describe("PaymentModal", () => {
  it("reviews terms only after the payment summary and returns to it when cancelled", async () => {
    const user = userEvent.setup();
    const onSelectPayment = vi.fn().mockResolvedValue(undefined);
    render(<PaymentModal booking={booking} requireBookingTerms onSelectPayment={onSelectPayment} onCancel={vi.fn()} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reserve and continue" }));
    expect(screen.getByRole("dialog", { name: "Review before payment" })).toBeVisible();
    expect(screen.queryByText("Demo payment")).not.toBeInTheDocument();
    expect(onSelectPayment).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog", { name: "Choose payment" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reserve and continue" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Agree and open checkout" }));
    expect(onSelectPayment).toHaveBeenCalledOnce();
  });
  it("makes the due amount clear and submits the selected payment plan", async () => {
    const user = userEvent.setup();
    const onSelectPayment = vi.fn().mockResolvedValue(undefined);
    render(<PaymentModal booking={booking} onSelectPayment={onSelectPayment} onCancel={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Choose payment" })).toBeInTheDocument();
    expect(screen.getByText("Mon, Sep 28, 2026 · 9:00 PM")).toBeInTheDocument();
    expect(screen.getAllByText("PHP 551").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Payment breakdown" })).toBeVisible();
    expect(screen.getByText(/does not have the seven-day repair-workmanship route/i)).toBeVisible();
    expect(screen.queryByText("Test payment")).not.toBeInTheDocument();

    expect(screen.queryByText("Full payment")).not.toBeInTheDocument();
    expect(screen.getAllByText("PHP 551").length).toBeGreaterThan(0);
    expect(screen.queryByText("GCash")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reserve and continue/i }));

    expect(onSelectPayment).toHaveBeenCalledWith(
      "paymongo-card",
      expect.objectContaining({
        paymentPlan: "downpayment",
        paymentAttemptAmount: 551,
        remainingBalanceAmount: 475,
        totalChargedAmount: 1026,
      }),
    );
    expect(screen.getByRole("button", { name: /reserve and continue/i })).toBeInTheDocument();
  });

  it("supports canceling from the footer", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PaymentModal booking={booking} onSelectPayment={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("collects only the remaining service balance after the deposit and fee were paid", async () => {
    const user = userEvent.setup();
    const onSelectPayment = vi.fn().mockResolvedValue(undefined);
    render(<PaymentModal booking={{ ...booking, quoteAmount: 1200, paymentStatus: "partially_paid", balanceDueAmount: 600, transactionFeeRate: 0.05 }} onSelectPayment={onSelectPayment} onCancel={vi.fn()} />);
    expect(screen.getAllByText("PHP 600", { exact: true })).toHaveLength(2);
    expect(screen.queryByText("Deposit and platform fee")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reserve and continue/i }));
    expect(onSelectPayment).toHaveBeenCalledWith("paymongo-card", expect.objectContaining({
      paymentAttemptAmount: 600, remainingBalanceAmount: 0, totalChargedAmount: 1260,
    }));
  });

  it("keeps checkout open and explains a server rejection", async () => {
    const user = userEvent.setup();
    const onSelectPayment = vi.fn().mockRejectedValue(new Error("Selected time is no longer available."));
    render(<PaymentModal booking={booking} onSelectPayment={onSelectPayment} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /reserve and continue/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Selected time is no longer available.");
    expect(screen.getByRole("dialog", { name: "Choose payment" })).toBeInTheDocument();
  });

  it("discloses an explicitly designated repair policy before checkout", () => {
    render(<PaymentModal booking={{ ...booking, rawService: { service_warranty_policies: {
      enabled: true, duration_days: 7,
      coverage_summary: "Report workmanship issues in the agreed repair scope for rework review.",
    } } }} onSelectPayment={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/designated repair service has a 7-day/i)).toBeVisible();
    expect(screen.getByText(/No refund is automatic/i)).toBeVisible();
  });
});
