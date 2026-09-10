import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "./Dashboard";

const { fetchSnapshot } = vi.hoisted(() => ({ fetchSnapshot: vi.fn() }));

vi.mock("@/features/bookings/services/bookingService", () => ({
  fetchClientDashboardSnapshot: fetchSnapshot,
}));

vi.mock("@/shared/components/DashboardNavigation", () => ({
  default: () => <nav aria-label="Dashboard navigation" />,
}));

describe("client Dashboard", () => {
  beforeEach(() => {
    fetchSnapshot.mockReset();
  });

  it("presents a useful schedule empty state", async () => {
    const user = userEvent.setup();
    const onOpenBrowseServices = vi.fn();
    fetchSnapshot.mockResolvedValue({ user: null, bookings: [], conversations: [], messages: [], unreadMessageCount: 0 });

    render(<Dashboard onOpenBrowseServices={onOpenBrowseServices} />);

    expect(await screen.findByRole("heading", { name: "No upcoming services" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Your next services" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Find a service" }));
    expect(onOpenBrowseServices).toHaveBeenCalledOnce();
  });

  it("separates upcoming services from recent activity", async () => {
    fetchSnapshot.mockResolvedValue({
      user: { id: "client-1" },
      unreadMessageCount: 0,
      conversations: [],
      messages: [],
      bookings: [{
        id: "booking-1",
        serviceType: "Home cleaning",
        workerName: "Nina Flores",
        status: "Payment Confirmed",
        startTs: "2099-09-28T09:00:00",
        raw: { booking: { updated_at: new Date().toISOString() } },
      }],
    });

    render(<Dashboard />);

    expect(await screen.findByRole("heading", { name: "Home cleaning" })).toBeVisible();
    expect(screen.getByText(/Nina Flores/)).toHaveTextContent("Nina Flores");
    await waitFor(() => expect(screen.getByRole("region", { name: "Recent updates" })).toHaveTextContent("Payment Confirmed"));
  });
});
