import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MyWork from "./MyWork";
import type { WorkPaymentTransaction } from "../types/payment";

const state = vi.hoisted(() => ({ transactions: [] as WorkPaymentTransaction[] }));

vi.mock("@/shared/components/DashboardNavigation", () => ({ default: () => null }));
vi.mock("../hooks", () => {
  const profile = { fullName: "Arnold Lim Castillo", serviceType: "Plumbing Leak Repair", fixedPrice: 800, raw: { id: 7 } };
  const services = [profile];
  return {
    useWorkProfileServices: () => ({
      activeServiceIndex: 0, currentProfile: profile, hasSellerRecord: true,
      isLoadingSellerData: false, sellerId: "worker-1", workerServices: services,
      setActiveServiceIndex: vi.fn(), refreshWorkData: vi.fn(),
    }),
    useWorkSchedule: () => ({
      scheduleMode: "calendar-only", calendarAvailability: [], dayKeys: [],
      weekOffset: 0, weeklySchedule: {},
      currentWeekMonday: new Date("2026-10-05"), currentWeekSunday: new Date("2026-10-11"),
    }),
    useWorkPayments: () => ({
      transactions: state.transactions, weekTransactions: [],
      cancelledCashTransactions: [], cashConfirmationNotifications: [], refundTransactions: [],
      cashPaymentView: "pending",
    }),
  };
});

const noop = () => {};
const props = {
  onThemeChange: noop, currentView: "my-work", searchQuery: "", onSearchChange: noop,
  onLogout: noop, onOpenSellerSetup: noop, onOpenMyBookings: noop, onOpenChatPage: noop,
  sellerProfile: { role: "worker" }, onOpenMyWork: noop, onOpenProfile: noop,
  onOpenAccountSettings: noop, onOpenSettings: noop, onOpenDashboard: noop,
  onOpenBrowseServices: noop, onBackToDashboard: noop, onAddNewWork: noop, onOpenAdminDashboard: noop,
};

function expectCount(label: string, count: number) {
  const summary = screen.getByRole("region", { name: "Current service summary" });
  const statistic = within(summary).getByText(label).parentElement;
  expect(statistic?.querySelector("strong")).toHaveTextContent(String(count));
}

describe("MyWork booking summary", () => {
  beforeEach(() => {
    state.transactions = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  });

  it("shows completed bookings from all transactions and updates when bookings refresh", () => {
    state.transactions = [
      { id: "scheduled", bookingStatus: "Scheduled" },
      { id: "completed", bookingStatus: "Completed Service" },
      { id: "cancelled", bookingStatus: "Cancelled" },
      { id: "refunded", bookingStatus: "Refunded" },
    ];
    const { rerender } = render(<MyWork {...props} />);
    expectCount("Completed", 1);
    expectCount("Active bookings", 1);

    state.transactions = state.transactions.map((transaction) => transaction.id === "scheduled"
      ? { ...transaction, bookingStatus: "Service Stopped" } : transaction);
    rerender(<MyWork {...props} />);
    expectCount("Completed", 2);
    expectCount("Active bookings", 0);
  });

  it("shows zero when there are no bookings", () => {
    render(<MyWork {...props} />);
    expectCount("Completed", 0);
  });

  it("keeps service actions in the manager when only one listing exists", () => {
    render(<MyWork {...props} />);

    const manager = screen.getByRole("region", { name: "Manage your services" });
    expect(within(manager).getByRole("button", { name: "Edit service" })).toBeVisible();
    expect(within(manager).getByRole("button", { name: "Delete service" })).toBeVisible();
    expect(within(manager).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Current service summary" }))
      .getByRole("heading", { name: "Arnold Lim Castillo" })).toBeVisible();
  });
});
