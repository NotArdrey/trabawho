import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkerDashboard from "./WorkerDashboard";
import type { ProviderDashboardSnapshot } from "@/features/work/types/provider-dashboard";

const refresh = vi.fn();
interface ProviderDashboardHookResult {
  snapshot: ProviderDashboardSnapshot | null;
  isLoading: boolean;
  error: string;
  refresh: typeof refresh;
}

const useProviderDashboard = vi.fn<(userId: string, profile: unknown) => ProviderDashboardHookResult>();

vi.mock("@/shared/components/DashboardNavigation", () => ({ default: () => <nav>Provider navigation</nav> }));
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
  actions: [{ id: "booking-1", priority: 2, title: "Respond to client request", detail: "Maria · Home repair", status: "Negotiating", bookingId: "booking-1", destination: "work" }],
  todaySchedule: [{ id: "booking-2", service: "Home repair", client: "Ana", schedule: "Sep 8, 2:00 PM", status: "Scheduled", bookingId: "booking-2" }],
  nextAppointment: null,
  serviceHealth: { totalListings: 2, activeListings: 1, availableSlots: 4, rating: 4.8, reviewCount: 12, verificationStatus: "approved" },
  confirmedEarnings: { amount: 1500, currency: "PHP", bookingCount: 1 },
  conversationIds: [],
};

describe("WorkerDashboard", () => {
  beforeEach(() => {
    refresh.mockClear();
    useProviderDashboard.mockReturnValue({ snapshot, isLoading: false, error: "", refresh });
  });

  it("presents provider priorities and opens the existing work flow", () => {
    const onOpenMyWork = vi.fn();
    render(<WorkerDashboard sellerProfile={{ userId: "worker-1", role: "worker" }} onOpenMyWork={onOpenMyWork} />);

    expect(screen.getByRole("heading", { name: /Good to see you, Jose Miguel/i })).toBeVisible();
    expect(screen.getByText("Confirmed earnings")).toBeVisible();
    expect(screen.getByText("₱1,500")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Respond to client request/i }));
    expect(onOpenMyWork).toHaveBeenCalledOnce();
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
