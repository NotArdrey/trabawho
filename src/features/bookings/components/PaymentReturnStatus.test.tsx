import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { fetchBookingById } from "@/features/bookings/services/bookingService";
import { PaymentReturnStatus } from "./PaymentReturnStatus";

vi.mock("@/features/bookings/services/bookingService", () => ({ fetchBookingById: vi.fn() }));
const { paymentAttemptQuery } = vi.hoisted(() => ({ paymentAttemptQuery: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: paymentAttemptQuery }) }) }) }) } }));

describe("PaymentReturnStatus", () => {
  it("keeps a cancelled checkout recoverable", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/bookings?payment=cancelled&booking=booking-1&attempt=attempt-1"]}><PaymentReturnStatus onBookingUpdated={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("Checkout cancelled")).toBeVisible();
    expect(screen.getByText(/retry while the reservation is still active/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss payment status" }));
    expect(screen.queryByText("Checkout cancelled")).not.toBeInTheDocument();
  });

  it("shows confirmation only after the server reports payment", async () => {
    vi.mocked(fetchBookingById).mockResolvedValue({ paymentStatus: "paid" } as never);
    paymentAttemptQuery.mockResolvedValue({ data: { status: "paid" }, error: null });
    const onBookingUpdated = vi.fn();
    render(<MemoryRouter initialEntries={["/bookings?payment=verifying&booking=booking-1&attempt=attempt-1"]}><PaymentReturnStatus onBookingUpdated={onBookingUpdated} /></MemoryRouter>);
    expect(screen.getByText("Verifying your payment")).toBeVisible();
    await waitFor(() => expect(screen.getByText("Payment confirmed")).toBeVisible());
    expect(onBookingUpdated).toHaveBeenCalledWith(expect.objectContaining({ paymentStatus: "paid" }));
  });
});
