import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBookingListController } from "./useBookingListController";
import { fetchClientBookings, fetchSellerBookings } from "@/features/bookings/services/bookingService";

vi.mock("@/features/bookings/services/bookingService", () => ({
  fetchClientBookings: vi.fn(), fetchSellerBookings: vi.fn(), submitBookingReview: vi.fn(), updateBookingWorkflow: vi.fn(),
}));
vi.mock("@/integrations/supabase", () => ({ isSupabaseConfigured: false }));

describe("booking list fetch recovery", () => {
  it("stops loading after the first request fails and recovers on retry", async () => {
    vi.mocked(fetchClientBookings).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useBookingListController());
    await waitFor(() => expect(result.current.loadError).toMatch(/connection and retry/i));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.bookings).toEqual([]);
    await act(async () => { await result.current.refreshBookings(); });
    expect(result.current.loadError).toBe("");
    expect(result.current.isLoading).toBe(false);
  });

  it("preserves existing records when a refresh fails", async () => {
    vi.mocked(fetchClientBookings).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const bookings = [{ id: "booking-1", status: "Dispute Open" }];
    const { result } = renderHook(() => useBookingListController(bookings, { autoLoad: false }));
    await act(async () => { await result.current.refreshBookings(); });
    expect(result.current.bookings).toEqual(bookings);
    expect(result.current.isLoading).toBe(false);
  });

  it("clears the old scope and stops loading after the new scope fails", async () => {
    vi.mocked(fetchSellerBookings).mockRejectedValueOnce(new Error("Failed to fetch"));
    const { result, rerender } = renderHook(({ role }: { role: "buyer" | "seller" }) =>
      useBookingListController([{ id: "buyer-only", status: "Completed Service" }], { autoLoad: false, listRole: role }),
    { initialProps: { role: "buyer" } });
    rerender({ role: "seller" });
    await act(async () => { await result.current.refreshBookings(); });
    expect(result.current.bookings).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
