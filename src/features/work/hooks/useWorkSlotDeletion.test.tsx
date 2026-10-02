import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkSlotDeletion } from "./useWorkSlotDeletion";
const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("../services/workDeletion", () => ({ deleteWorkSlot: remove }));
describe("availability deletion", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each(["calendar-only", "with-slots"])("confirms %s deletion and allows retry after failure", async (scheduleMode) => {
    const loadSlots = vi.fn();
    const setScheduleError = vi.fn();
    const { result } = renderHook(() => useWorkSlotDeletion({ sellerId: "worker", scheduleMode, calendarAvailability: [{ id: 8, date: "2026-10-05" }], weeklySchedule: { Mon: [{ id: 8, startTime: "09:00", endTime: "10:00" }] }, loadSlots, setScheduleError }));
    act(() => result.current.handleDeleteSlot("Mon", 8));
    expect(remove).not.toHaveBeenCalled();
    act(() => result.current.setDeleteConfirmTarget(null));
    expect(remove).not.toHaveBeenCalled();
    act(() => result.current.handleDeleteSlot("Mon", 8));
    remove.mockRejectedValueOnce(new Error("Slot has a booking"));
    await act(async () => { await result.current.handleConfirmDelete(); });
    expect(result.current.deleteConfirmTarget?.slotId).toBe(8);
    expect(setScheduleError).toHaveBeenLastCalledWith("Slot has a booking");
    remove.mockResolvedValue(undefined);
    await act(async () => { await result.current.handleConfirmDelete(); });
    expect(remove).toHaveBeenLastCalledWith(8, "worker");
    expect(result.current.deleteConfirmTarget).toBeNull();
    expect(loadSlots).toHaveBeenCalledOnce();
  });
});
