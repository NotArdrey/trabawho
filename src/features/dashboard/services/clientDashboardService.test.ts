import { beforeEach, expect, it, vi } from "vitest";
import { fetchClientDashboardSnapshot } from "@/features/bookings/services/bookingService";
import { getActiveReplacementSchedules } from "@/features/bookings/services/replacementSchedules";
import { fetchClientOverviewSnapshot } from "./clientDashboardService";

vi.mock("@/features/bookings/services/bookingService", () => ({ fetchClientDashboardSnapshot: vi.fn() }));
vi.mock("@/features/bookings/services/replacementSchedules", () => ({ getActiveReplacementSchedules: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it("uses the accepted replacement only for its booking without changing booking history", async () => {
  vi.mocked(fetchClientDashboardSnapshot).mockResolvedValue({
    user: { id: "client-1" }, conversations: [], messages: [], unreadMessageCount: 0,
    bookings: [
      { id: "disputed-1", status: "Dispute Open", raw: { booking: { start_ts: "2026-10-05T23:00:00+08:00" } } },
      { id: "normal-2", status: "Payment Confirmed", raw: { booking: { start_ts: "2026-10-12T13:00:00+08:00" } } },
    ],
  } as never);
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map([["disputed-1", {
    bookingId: "disputed-1", caseId: "case-1", status: "accepted",
    startAt: "2026-10-10T16:00:00+08:00", endAt: "2026-10-10T17:00:00+08:00", acceptedAt: "2026-10-06T09:00:00+08:00",
  }]]));

  const snapshot = await fetchClientOverviewSnapshot();
  expect(getActiveReplacementSchedules).toHaveBeenCalledWith(["disputed-1", "normal-2"]);
  expect(snapshot.bookings[0].activeReplacementStartAt).toBe("2026-10-10T16:00:00+08:00");
  expect(snapshot.bookings[0].activeReplacementAcceptedAt).toBe("2026-10-06T09:00:00+08:00");
  expect(snapshot.bookings[0].raw?.booking?.start_ts).toBe("2026-10-05T23:00:00+08:00");
  expect(snapshot.bookings[1].activeReplacementStartAt).toBeUndefined();
});

it("does not query replacement visits when there are no bookings", async () => {
  vi.mocked(fetchClientDashboardSnapshot).mockResolvedValue({ user: null, bookings: [], conversations: [], messages: [], unreadMessageCount: 0 });
  expect((await fetchClientOverviewSnapshot()).bookings).toEqual([]);
  expect(getActiveReplacementSchedules).not.toHaveBeenCalled();
});
