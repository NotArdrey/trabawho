import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRealtimeNotifications } from "@/components/notifications";
import DashboardNavigation from "./DashboardNavigation";

vi.mock("@/components/notifications", async () => {
  const original = await import("@/components/notifications/notification-center");
  return { ...original, useRealtimeNotifications: vi.fn() };
});

const markRead = vi.fn();
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

describe("dashboard notification navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRealtimeNotifications).mockReturnValue({ notifications: [{ id: "case:notice-1", caseId: "case-123",
      title: "Support update", message: "Support replied to the case.", isRead: false, type: "case",
      href: "/support-cases?case=case-123#case-conversation" }], isLoading: false, error: "", actionError: "",
      markRead, markAllRead: vi.fn(), retry: vi.fn() });
  });

  it("opens the exact support case and marks its alert read", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}>
      <DashboardNavigation currentView="client-dashboard" sellerProfile={{ userId: "client-1", role: "client" }} />
      <LocationProbe />
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(screen.getByRole("button", { name: /Support update/ }));
    expect(markRead).toHaveBeenCalledWith("case:notice-1");
    expect(screen.getByTestId("location")).toHaveTextContent("/support-cases?case=case-123#case-conversation");
  });
});
