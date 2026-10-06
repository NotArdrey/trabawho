import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkerDashboard from "./WorkerDashboard";
import type { ProviderDashboardSnapshot } from "@/features/work/types/provider-dashboard";

const refresh = vi.fn();
const navigate = vi.hoisted(() => vi.fn());
interface ProviderDashboardHookResult {
  snapshot: ProviderDashboardSnapshot | null;
  isLoading: boolean;
  error: string;
  refresh: typeof refresh;
}

const useProviderDashboard = vi.fn<(userId: string, profile: unknown) => ProviderDashboardHookResult>();

vi.mock("@/shared/components/DashboardNavigation", () => ({ default: () => <nav>Provider navigation</nav> }));
vi.mock("react-router-dom", async (importOriginal) => ({ ...await importOriginal<Record<string, unknown>>(), useNavigate: () => navigate }));
vi.mock("@/features/work/hooks/useProviderDashboard", () => ({ useProviderDashboard: (userId: string, profile: unknown) => useProviderDashboard(userId, profile) }));

const snapshot: ProviderDashboardSnapshot = {
  providerName: "Jose Miguel",
  hasProviderSetup: true,
  metrics: [
    { id: "inquiries", label: "Open inquiries", value: "2", detail: "Waiting for your response" },
    { id: "today", label: "Today's jobs", value: "1", detail: "Scheduled for today" },
    { id: "messages", label: "Unread messages", value: "3", detail: "From active conversations" },
    { id: "earnings", label: "Confirmed earnings", value: "₱1,500", detail: "1 confirmed payment" },
  ],
  actions: [{ id: "booking-1", priority: 2, title: "Respond to client request", detail: "Maria · Home repair", status: "Negotiating", bookingId: "booking-1", destination: "bookings" }],
  todaySchedule: [{ id: "booking-2", service: "Home repair", client: "Ana", schedule: "Sep 8, 2:00 PM", status: "Scheduled", bookingId: "booking-2" }],
  nextAppointment: null,
  serviceHealth: { totalListings: 2, activeListings: 1, availableSlots: 4, rating: 4.8, reviewCount: 12, verificationStatus: "approved" },
  confirmedEarnings: { amount: 1500, currency: "PHP", bookingCount: 1 },
  conversationIds: [],
};

describe("WorkerDashboard", () => {
  beforeEach(() => {
    refresh.mockClear();
    navigate.mockClear();
    useProviderDashboard.mockReturnValue({ snapshot, isLoading: false, error: "", refresh });
  });

  it("opens a standalone unread conversation and the incoming message inbox", () => {
    const onOpenChatPage = vi.fn();
    useProviderDashboard.mockReturnValue({ snapshot: { ...snapshot, actions: [{ id: "message-1", priority: 3, title: "Unread client message", detail: "Hello", conversationId: "conversation-1", destination: "messages" }] }, isLoading: false, error: "", refresh });
    render(<WorkerDashboard sellerProfile={{ userId: "worker-1" }} onOpenChatPage={onOpenChatPage} />);
    fireEvent.click(screen.getByRole("button", { name: /Unread client message/ }));
    expect(onOpenChatPage).toHaveBeenLastCalledWith("conversation-1", "incoming");
    fireEvent.click(screen.getByRole("button", { name: "Open client messages" }));
    expect(onOpenChatPage).toHaveBeenLastCalledWith(null, "incoming");
  });

  it("presents provider priorities and opens incoming bookings", () => {
    const onOpenMyBookings = vi.fn();
    render(<WorkerDashboard sellerProfile={{ userId: "worker-1", role: "worker" }} onOpenMyBookings={onOpenMyBookings} />);

    expect(screen.getByRole("heading", { name: /Good to see you, Jose Miguel/i })).toBeVisible();
    expect(screen.getByText("Confirmed earnings")).toBeVisible();
    expect(screen.getByText("₱1,500")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open incoming bookings" }));
    fireEvent.click(screen.getByRole("button", { name: /Respond to client request/i }));
    expect(onOpenMyBookings).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/worker/bookings?scope=incoming&filter=all&q=booking-1&focus=booking-1");
  });

  it("routes payment and refund alerts to the matching My Work queue", () => {
    useProviderDashboard.mockReturnValue({ snapshot: { ...snapshot, actions: [
      { id: "cash-1", priority: 1, title: "Review payment confirmation", detail: "Ana", bookingId: "booking-1", destination: "work", workSection: "cash-approvals" },
      { id: "refund-1", priority: 1, title: "Review refund request", detail: "Ben", bookingId: "booking-2", destination: "work", workSection: "refunds" },
    ] }, isLoading: false, error: "", refresh });
    render(<WorkerDashboard sellerProfile={{ userId: "worker-1" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Review payment confirmation/ }));
    fireEvent.click(screen.getByRole("button", { name: /Review refund request/ }));
    expect(navigate).toHaveBeenNthCalledWith(1, "/work?section=cash-approvals&booking=booking-1");
    expect(navigate).toHaveBeenNthCalledWith(2, "/work?section=refunds&booking=booking-2");
  });

  it("opens the specific scheduled booking and the inquiry tab", () => {
    render(<WorkerDashboard sellerProfile={{ userId: "worker-1" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Open incoming bookings" }));
    expect(navigate).toHaveBeenCalledWith("/worker/bookings?scope=incoming&filter=inquiries");
    fireEvent.click(screen.getByRole("button", { name: /Home repairAna/ }));
    expect(navigate).toHaveBeenCalledWith("/worker/bookings?scope=incoming&filter=all&q=booking-2&focus=booking-2");
  });

  it("makes clear queues and an empty day recognizable and actionable", () => {
    const onOpenMyWork = vi.fn();
    useProviderDashboard.mockReturnValue({ snapshot: { ...snapshot, actions: [], todaySchedule: [] }, isLoading: false, error: "", refresh });
    render(<WorkerDashboard sellerProfile={{ userId: "worker-1" }} onOpenMyWork={onOpenMyWork} />);

    expect(screen.getByRole("heading", { name: "You're all caught up" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your day is clear" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Manage availability" }));
    expect(onOpenMyWork).toHaveBeenCalledOnce();
  });

  it("separates the next appointment from today's schedule", () => {
    useProviderDashboard.mockReturnValue({ snapshot: { ...snapshot, todaySchedule: [], nextAppointment: snapshot.todaySchedule[0] }, isLoading: false, error: "", refresh });
    render(<WorkerDashboard sellerProfile={{ userId: "worker-1" }} />);
    expect(screen.getByText("Next appointment")).toBeVisible();
    expect(screen.getByText("Ana · Sep 8, 2:00 PM")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Next appointment/ }));
    expect(navigate).toHaveBeenCalledWith("/worker/bookings?scope=incoming&filter=all&q=booking-2&focus=booking-2");
  });

  it("shows incomplete service health without inventing a rating", () => {
    useProviderDashboard.mockReturnValue({ snapshot: { ...snapshot, serviceHealth: { ...snapshot.serviceHealth, totalListings: 0, activeListings: 0, availableSlots: 0, rating: null, reviewCount: 0 } }, isLoading: false, error: "", refresh });
    render(<WorkerDashboard sellerProfile={{ userId: "worker-1" }} />);
    expect(screen.getByLabelText("Service health statistics")).toHaveTextContent("0 of 0");
    expect(screen.getByLabelText("Service health statistics")).toHaveTextContent("—");
  });

  it("preserves loading and recoverable error states", () => {
    useProviderDashboard.mockReturnValue({ snapshot: null, isLoading: true, error: "", refresh });
    const { rerender } = render(<WorkerDashboard sellerProfile={{ userId: "worker-1" }} />);
    expect(screen.getByLabelText("Loading provider dashboard")).toBeVisible();

    useProviderDashboard.mockReturnValue({ snapshot, isLoading: false, error: "Connection unavailable", refresh });
    rerender(<WorkerDashboard sellerProfile={{ userId: "worker-1" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
