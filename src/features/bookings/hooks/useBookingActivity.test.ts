import { act, renderHook } from "@testing-library/react";
import { useBookingActivity } from "./useBookingActivity";

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../services/bookingActivity", () => ({ subscribeToBookingActivity: mocks.subscribe }));

describe("booking activity recovery", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.subscribe.mockReturnValue(mocks.unsubscribe); });
  afterEach(() => { vi.useRealTimers(); });
  it("refreshes for realtime events, reconnects and visible reconciliation, then cleans up", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useBookingActivity(refresh));
    const onChange = mocks.subscribe.mock.calls[0]?.[0] as () => void;
    await act(async () => { onChange(); onChange(); await vi.advanceTimersByTimeAsync(250); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(250); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(refresh).toHaveBeenCalledTimes(3);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); window.dispatchEvent(new Event("focus")); });
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
  it("does not subscribe for a disabled scope", () => {
    renderHook(() => useBookingActivity(vi.fn(), false));
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("uses slower reconciliation for the support-only subscription", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useBookingActivity(refresh, true, 60_000, "support"));
    expect(mocks.subscribe).toHaveBeenCalledWith(expect.any(Function), "support");
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(refresh).toHaveBeenCalledOnce();
    unmount();
  });
});
