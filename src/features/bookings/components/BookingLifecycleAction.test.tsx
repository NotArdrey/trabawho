import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { performBookingLifecycleAction } from "@/features/bookings/services/bookingLifecycle";
import type { BookingLifecycleRecord } from "@/features/bookings/services/bookingLifecycle";
import { BookingLifecycleAction } from "./BookingLifecycleAction";

vi.mock("@/features/bookings/services/bookingLifecycle", () => ({
  performBookingLifecycleAction: vi.fn(),
}));

const booking = {
  id: "booking-1",
  status: "Payment Confirmed",
  scheduleStatus: "confirmed",
  paymentStatus: "paid",
  deliveryStatus: "not_delivered",
  disputeStatus: "none",
  raw: { booking: { status: "confirmed" } },
};
const onUpdated = vi.fn();
const onSuccess = vi.fn();
const onError = vi.fn();

function renderAction(role: "client" | "provider", record = booking) {
  return render(
    <BookingLifecycleAction
      booking={record}
      viewerRole={role}
      onUpdated={onUpdated}
      onSuccess={onSuccess}
      onError={onError}
    />,
  );
}

describe("BookingLifecycleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows delivery only to the provider of a paid, confirmed booking", () => {
    const { rerender } = renderAction("provider");
    expect(screen.getByRole("button", { name: "Mark Delivered" })).toBeVisible();

    const unpaid = { ...booking, paymentStatus: "partially_paid" };
    rerender(<BookingLifecycleAction booking={unpaid} viewerRole="provider" onUpdated={onUpdated} onSuccess={onSuccess} onError={onError} />);
    expect(screen.queryByRole("button", { name: "Mark Delivered" })).not.toBeInTheDocument();

    rerender(<BookingLifecycleAction booking={{ ...booking, scheduleStatus: "reschedule_requested" }} viewerRole="provider" onUpdated={onUpdated} onSuccess={onSuccess} onError={onError} />);
    expect(screen.queryByRole("button", { name: "Mark Delivered" })).not.toBeInTheDocument();

    rerender(<BookingLifecycleAction booking={booking} viewerRole="client" onUpdated={onUpdated} onSuccess={onSuccess} onError={onError} />);
    expect(screen.queryByRole("button", { name: "Mark Delivered" })).not.toBeInTheDocument();
  });

  it("shows the client the next step only after provider delivery", () => {
    const { rerender } = renderAction("client");
    expect(screen.getByText("Waiting for provider delivery")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm Completion" })).not.toBeInTheDocument();

    rerender(<BookingLifecycleAction booking={{ ...booking, deliveryStatus: "seller_claimed" }} viewerRole="client" onUpdated={onUpdated} onSuccess={onSuccess} onError={onError} />);
    expect(screen.getByRole("button", { name: "Confirm Completion" })).toBeVisible();

    rerender(<BookingLifecycleAction booking={{ ...booking, deliveryStatus: "buyer_confirmed", raw: { booking: { status: "completed" } } }} viewerRole="client" onUpdated={onUpdated} onSuccess={onSuccess} onError={onError} />);
    expect(screen.queryByRole("button", { name: "Confirm Completion" })).not.toBeInTheDocument();
  });

  it("blocks duplicate clicks until delivery and refresh finish", async () => {
    let finish: ((value: BookingLifecycleRecord) => void) | undefined;
    vi.mocked(performBookingLifecycleAction).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderAction("provider");

    const button = screen.getByRole("button", { name: "Mark Delivered" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(performBookingLifecycleAction).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    finish?.({ ...booking, deliveryStatus: "seller_claimed" });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ deliveryStatus: "seller_claimed" })));
    expect(onSuccess).toHaveBeenCalledWith("deliver");
  });

  it("shows a failure and allows retry", async () => {
    vi.mocked(performBookingLifecycleAction)
      .mockRejectedValueOnce(new Error("Server unavailable"))
      .mockResolvedValueOnce({ ...booking, deliveryStatus: "seller_claimed" });
    renderAction("provider");

    fireEvent.click(screen.getByRole("button", { name: "Mark Delivered" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
    expect(onError).toHaveBeenCalledWith("deliver", "Server unavailable");

    fireEvent.click(screen.getByRole("button", { name: "Mark Delivered" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
