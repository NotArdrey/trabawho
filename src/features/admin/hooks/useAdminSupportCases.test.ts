import { act, renderHook } from "@testing-library/react";
import { subscribeToAdminSupportActivity } from "../services/adminSupportActivity";
import { listSupportCases, type SupportCase } from "../services/adminSupportService";
import { useAdminSupportCases } from "./useAdminSupportCases";

vi.mock("../services/adminSupportActivity", () => ({ subscribeToAdminSupportActivity: vi.fn() }));
vi.mock("../services/adminSupportService", () => ({ listSupportCases: vi.fn() }));

const item = { id: "case-1", booking_id: "booking-1", status: "open" } as SupportCase;

describe("admin support queue reconciliation", () => {
  const unsubscribe = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(listSupportCases).mockResolvedValue([]);
    vi.mocked(subscribeToAdminSupportActivity).mockReturnValue(unsubscribe);
  });
  afterEach(() => vi.useRealTimers());

  it("loads new reports on realtime events and keeps listening after refresh", async () => {
    const { result } = renderHook(() => useAdminSupportCases());
    await act(async () => {});
    expect(result.current.cases).toEqual([]);
    vi.mocked(listSupportCases).mockResolvedValue([item]);
    const onChange = vi.mocked(subscribeToAdminSupportActivity).mock.calls[0][0];
    await act(async () => { onChange(); onChange(); await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.cases).toEqual([item]);
    expect(listSupportCases).toHaveBeenCalledTimes(2);
    expect(subscribeToAdminSupportActivity).toHaveBeenCalledOnce();
  });

  it("reconciles without realtime, on focus and reconnect, and cleans up", async () => {
    const { result, unmount } = renderHook(() => useAdminSupportCases());
    await act(async () => {});
    vi.mocked(listSupportCases).mockResolvedValue([item]);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.cases).toEqual([item]);
    await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(250); });
    await act(async () => { window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(250); });
    expect(listSupportCases).toHaveBeenCalledTimes(4);
    unmount();
    await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(30_000); });
    expect(listSupportCases).toHaveBeenCalledTimes(4);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("preserves cases after a background failure and recovers on manual refresh", async () => {
    vi.mocked(listSupportCases).mockResolvedValueOnce([item]);
    const { result } = renderHook(() => useAdminSupportCases());
    await act(async () => {});
    vi.mocked(listSupportCases).mockRejectedValueOnce(new Error("Try refreshing."));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.cases).toEqual([item]);
    expect(result.current.error).toBe("Try refreshing.");
    await act(async () => { result.current.refresh(); await Promise.resolve(); });
    expect(result.current.error).toBe("");
    expect(result.current.loading).toBe(false);
  });

  it("discards a stale response when a newer refresh has completed", async () => {
    let resolveOld!: (items: SupportCase[]) => void;
    vi.mocked(listSupportCases).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    const { result } = renderHook(() => useAdminSupportCases());
    vi.mocked(listSupportCases).mockResolvedValue([item]);
    await act(async () => { result.current.refresh(); await Promise.resolve(); });
    await act(async () => { resolveOld([]); await Promise.resolve(); });
    expect(result.current.cases).toEqual([item]);
  });

  it("skips hidden pages and reconciles when they become visible", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    renderHook(() => useAdminSupportCases());
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(listSupportCases).toHaveBeenCalledOnce();
    visibility.mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(250); });
    expect(listSupportCases).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });
});
