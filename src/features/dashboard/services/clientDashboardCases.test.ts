import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchClientOverviewCases } from "./clientDashboardCases";

const { listCases } = vi.hoisted(() => ({ listCases: vi.fn() }));
vi.mock("@/features/bookings/support", () => ({ listParticipantSupportCases: listCases }));

describe("client dashboard cases", () => {
  beforeEach(() => listCases.mockReset());

  it("only returns open cases where the viewer is the client", async () => {
    listCases.mockResolvedValue([
      { viewerRole: "client", report: { id: "open", booking_id: "booking-1", status: "under_review", resolution_status: "awaiting_client", created_at: "2026-10-01", latest_support_at: "2026-10-06" }, serviceTitle: "Cleaning", unreadCount: 2 },
      { viewerRole: "provider", report: { id: "provider", status: "open" } },
      { viewerRole: "client", report: { id: "closed", status: "closed" } },
    ]);
    await expect(fetchClientOverviewCases()).resolves.toEqual([{ id: "open", bookingId: "booking-1", service: "Cleaning", status: "under_review", resolution: "awaiting_client", unreadCount: 2, updatedAt: "2026-10-06" }]);
  });

});
