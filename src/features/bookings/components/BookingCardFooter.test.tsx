import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BookingCardFooter } from "./BookingCardFooter";

const props = { amountLabel: "Service price", amount: "PHP 950", platformFee: "PHP 47.50",
  totalPayment: "PHP 997.50", messageLabel: "Message provider", messageIsPrimary: true,
  onViewDetails: vi.fn(), onMessage: vi.fn() };

it("labels seeded pricing as illustrative rather than a charge", () => {
  render(<BookingCardFooter {...props} demoPayment />);
  expect(screen.getByText("Illustrative total")).toBeVisible();
  expect(screen.queryByText("Total payment")).not.toBeInTheDocument();
});

it("keeps the payment total for normal bookings", () => {
  render(<BookingCardFooter {...props} />);
  expect(screen.getByText("Total payment")).toBeVisible();
});
