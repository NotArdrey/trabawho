import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { getActiveReplacementSchedules } from "@/features/bookings/services/replacementSchedules";
import { useProviderReplacementSchedules } from "./useProviderReplacementSchedules";

vi.mock("@/features/bookings/services/replacementSchedules", () => ({ getActiveReplacementSchedules: vi.fn() }));
vi.mock("@/features/bookings/hooks/useBookingActivity", () => ({ useBookingActivity: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it("loads replacement windows for the provider's bookings", async () => {
  vi.mocked(getActiveReplacementSchedules).mockResolvedValue(new Map([["job-1", {
    bookingId: "job-1", caseId: "case-1", status: "accepted",
    startAt: "2026-10-10T01:00:00Z", endAt: "2026-10-10T02:00:00Z",
  }]]));
  const { result } = renderHook(() => useProviderReplacementSchedules([{ id: "job-1" }], true));
  await waitFor(() => expect(result.current.get("job-1")?.status).toBe("accepted"));
  expect(getActiveReplacementSchedules).toHaveBeenCalledWith(["job-1"]);
});

it("does not request a provider calendar on the client side", () => {
  const { result } = renderHook(() => useProviderReplacementSchedules([{ id: "job-1" }], false));
  expect(result.current.size).toBe(0);
  expect(getActiveReplacementSchedules).not.toHaveBeenCalled();
});
