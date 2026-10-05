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

it("shows the booking creation time to clients separately from the visit", () => {
  render(<BookingCardFooter {...props} createdAt="2026-10-05T05:07:00Z" />);
  expect(screen.getByText("Booked on")).toBeVisible();
  expect(screen.getByText(/Oct 5, 2026.*1:07 PM PHT/)).toBeVisible();
});

it("keeps chat-only requests labeled as requests", () => {
  render(<BookingCardFooter {...props} requestDate="2026-10-05" />);
  expect(screen.getByText("Requested on")).toBeVisible();
  expect(screen.queryByText("Booked on")).not.toBeInTheDocument();
});
