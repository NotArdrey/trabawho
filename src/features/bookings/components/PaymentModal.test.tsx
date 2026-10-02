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
  it("makes the due amount clear and submits the selected payment plan", async () => {
    const user = userEvent.setup();
    const onSelectPayment = vi.fn().mockResolvedValue(undefined);
    render(<PaymentModal booking={booking} onSelectPayment={onSelectPayment} onCancel={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Choose payment" })).toBeInTheDocument();
    expect(screen.getByText("Mon, Sep 28, 2026 · 9:00 PM")).toBeInTheDocument();
    expect(screen.getAllByText("PHP 522.50").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Payment breakdown" })).toBeVisible();
    expect(screen.queryByText("Test payment")).not.toBeInTheDocument();

    expect(screen.queryByText("Full payment")).not.toBeInTheDocument();
    expect(screen.getAllByText("PHP 522.50").length).toBeGreaterThan(0);
    expect(screen.getByText("GCash")).toBeVisible();
    expect(screen.getByText("Coming soon")).toBeVisible();
    expect(screen.getByRole("radio", { name: /GCash/i })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", { name: /reserve and continue/i }));

    expect(onSelectPayment).toHaveBeenCalledWith(
      "paymongo-card",
      expect.objectContaining({
        paymentPlan: "downpayment",
        paymentAttemptAmount: 522.5,
        remainingBalanceAmount: 475,
        totalChargedAmount: 997.5,
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

  it("keeps checkout open and explains a server rejection", async () => {
    const user = userEvent.setup();
    const onSelectPayment = vi.fn().mockRejectedValue(new Error("Selected time is no longer available."));
    render(<PaymentModal booking={booking} onSelectPayment={onSelectPayment} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /reserve and continue/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Selected time is no longer available.");
    expect(screen.getByRole("dialog", { name: "Choose payment" })).toBeInTheDocument();
  });
});
