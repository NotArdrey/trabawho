import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase", () => ({ supabase: { rpc } }));

import { useMarketplaceSchedules } from "./useMarketplaceSchedules";

describe("useMarketplaceSchedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-05T09:00:00Z"));
    rpc.mockResolvedValue({ data: [], error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("only loads future public slots that remain available", async () => {
    const providers = [{ id: "provider-1", rawService: { id: 7 } }];
    renderHook(() => useMarketplaceSchedules(providers));

    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith("list_available_service_slots", { p_service_ids: [7] });
  });

  it("removes today's slots before building marketplace calendar choices", async () => {
    rpc.mockResolvedValue({ data: [
      { id: 1, service_id: 7, start_ts: "2026-10-05T10:00:00Z", end_ts: "2026-10-05T11:00:00Z", status: "available", capacity: 1 },
      { id: 2, service_id: 7, start_ts: "2026-10-06T01:00:00Z", end_ts: "2026-10-06T02:00:00Z", status: "available", capacity: 1 },
    ], error: null });
    const providers = [{ id: "provider-1", rawService: { id: 7 }, bookingMode: "with-slots" }];
    const { result } = renderHook(() => useMarketplaceSchedules(providers));
    await waitFor(() => expect(result.current.schedulesByProvider["provider-1"]?.dayBlocks["2026-10-06"]).toHaveLength(1));
    expect(result.current.schedulesByProvider["provider-1"]?.dayBlocks["2026-10-05"]).toBeUndefined();
  });
});
