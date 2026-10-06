import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "./Dashboard";

const { fetchSnapshot, fetchCases } = vi.hoisted(() => ({ fetchSnapshot: vi.fn(), fetchCases: vi.fn() }));

vi.mock("@/features/dashboard/services/clientDashboardService", () => ({
  fetchClientOverviewSnapshot: fetchSnapshot,
}));
vi.mock("@/features/dashboard/services/clientDashboardCases", () => ({ fetchClientOverviewCases: fetchCases }));

vi.mock("@/features/bookings/activity", () => ({ useBookingActivity: vi.fn() }));

vi.mock("@/shared/components/DashboardNavigation", () => ({
  default: () => <nav aria-label="Dashboard navigation" />,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe("client Dashboard", () => {
  beforeEach(() => {
    fetchSnapshot.mockReset();
    fetchCases.mockReset();
    fetchCases.mockResolvedValue([]);
  });

  it("presents a useful schedule empty state", async () => {
    const user = userEvent.setup();
    const onOpenBrowseServices = vi.fn();
    fetchSnapshot.mockResolvedValue({ user: null, bookings: [], conversations: [], messages: [], unreadMessageCount: 0 });

    render(<MemoryRouter><Dashboard onOpenBrowseServices={onOpenBrowseServices} /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "No upcoming services" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Your next services" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Your next steps" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Find a service" }));
    expect(onOpenBrowseServices).toHaveBeenCalledOnce();
  });

  it("separates upcoming services from recent activity", async () => {
    const user = userEvent.setup();
    const onOpenMyBookings = vi.fn();
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

    render(<MemoryRouter><Dashboard onOpenMyBookings={onOpenMyBookings} /><LocationProbe /></MemoryRouter>);

    const bookingLink = await screen.findByRole("link", { name: /Open Home cleaning booking with Nina Flores/ });
    expect(bookingLink).toBeVisible();
    expect(screen.getByText("Home cleaning")).toHaveClass("text-sm", "font-semibold");
    expect(screen.getByText(/Nina Flores/)).toHaveTextContent("Nina Flores");
    await user.click(bookingLink);
    expect(screen.getByTestId("location")).toHaveTextContent("/bookings?scope=purchases&filter=all&q=booking-1&focus=booking-1");
    await waitFor(() => expect(screen.getByRole("region", { name: "Recent updates" })).toHaveTextContent("Payment Confirmed"));
    expect(screen.getByRole("region", { name: "Recent updates" }).querySelector("a")).toHaveAttribute("href", "/bookings?scope=purchases&filter=all&q=booking-1&focus=booking-1");
    const viewAll = screen.getAllByRole("button", { name: "View all bookings" })[0];
    expect(viewAll).toHaveClass("bg-primary");
    await user.click(viewAll);
    expect(onOpenMyBookings).toHaveBeenCalledOnce();
  });

  it("identifies an agreed replacement visit without coloring an open dispute as a success", async () => {
    fetchSnapshot.mockResolvedValue({ user: { id: "client-1" }, unreadMessageCount: 0, conversations: [], messages: [],
      bookings: [{ id: "replacement-1", serviceType: "Apartment cleaning", workerName: "Maria", status: "Dispute Open",
      activeReplacementStartAt: "2099-10-10T16:00:00+08:00", raw: { booking: { start_ts: "2026-10-05T23:00:00+08:00" } } }] });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    const link = await screen.findByRole("link", { name: /Open Apartment cleaning booking with Maria/ });
    expect(link).toHaveTextContent("Replacement visit");
    expect(link).toHaveTextContent("Agreed new time · Support case open");
    expect(link).not.toHaveTextContent("Oct 5");
    expect(screen.getByRole("region", { name: "Recent updates" })).toHaveTextContent("Replacement visit confirmed");
  });

  it("does not call an unverified schedule empty when the latest visit lookup fails", async () => {
    fetchSnapshot.mockRejectedValue(new Error("Schedule lookup failed"));
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Schedule unavailable" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "No upcoming services" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry schedule" })).toBeVisible();
  });

  it("shows booking actions and case progress below the schedule without repeating the appointment", async () => {
    fetchSnapshot.mockResolvedValue({ user: { id: "client-1" }, unreadMessageCount: 0, conversations: [], messages: [], bookings: [
      { id: "due-1", serviceType: "Cleaning", workerName: "Mia", status: "Payment Pending", paymentStatus: "unpaid" },
      { id: "visit-1", serviceType: "Painting", workerName: "Leo", status: "Payment Confirmed", startTs: "2099-09-28T09:00:00" },
    ] });
    fetchCases.mockResolvedValue([{ id: "case-1", bookingId: "visit-1", service: "Painting", status: "under_review", resolution: "awaiting_client", unreadCount: 1, updatedAt: "2026-10-06T10:00:00Z" }]);
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    const panel = await screen.findByRole("region", { name: "Your next steps" });
    expect(panel).toHaveTextContent("Complete booking payment");
    expect(panel).toHaveTextContent("Reply to support");
    expect(panel).not.toHaveTextContent("Leo");
    expect(screen.getByRole("link", { name: /Complete booking payment/ })).toHaveAttribute("href", "/bookings?scope=purchases&filter=all&q=due-1&focus=due-1");
    expect(screen.getByRole("link", { name: /Reply to support/ })).toHaveAttribute("href", "/support-cases?case=case-1#case-conversation");
  });

  it("keeps the schedule visible if case progress fails to load", async () => {
    fetchSnapshot.mockResolvedValue({ user: { id: "client-1" }, unreadMessageCount: 0, conversations: [], messages: [], bookings: [
      { id: "visit-1", serviceType: "Painting", workerName: "Leo", status: "Payment Confirmed", startTs: "2099-09-28T09:00:00" },
    ] });
    fetchCases.mockRejectedValue(new Error("Case lookup failed"));
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: /Open Painting booking with Leo/ })).toBeVisible();
    expect(await screen.findByRole("button", { name: "Retry cases" })).toBeVisible();
  });
});
