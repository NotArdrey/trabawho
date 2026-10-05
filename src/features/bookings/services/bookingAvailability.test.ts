import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({ supabase: { rpc } }));

import { fetchPublicServiceSlots } from "./bookingAvailability";

describe("public booking availability", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T09:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("loads provider-wide free slots without reading booking identities", async () => {
    rpc.mockResolvedValue({ data: [{ id: 12, service_id: 4, start_ts: "2026-10-06T09:00:00Z",
      end_ts: "2026-10-06T10:00:00Z", capacity: 3, metadata: { booked_count: 2 } }], error: null });
    await expect(fetchPublicServiceSlots(4)).resolves.toEqual([expect.objectContaining({ id: 12, booked_count: 0, capacity: 1 })]);
    expect(rpc).toHaveBeenCalledWith("list_available_service_slots", { p_service_ids: [4] });
  });

  it("does not display slots when provider availability cannot be verified", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(fetchPublicServiceSlots(4)).rejects.toEqual({ message: "unavailable" });
  });

  it("shows one choice for legacy duplicate rows with the same time window", async () => {
    rpc.mockResolvedValue({ data: [12, 13].map((id) => ({ id, service_id: 4,
      start_ts: "2026-10-06T09:00:00Z", end_ts: "2026-10-06T10:00:00Z", capacity: 1 })), error: null });
    await expect(fetchPublicServiceSlots(4)).resolves.toEqual([expect.objectContaining({ id: 12 })]);
  });

  it("filters today's slots even if they are later than the current hour", async () => {
    rpc.mockResolvedValue({ data: [{ id: 1, service_id: 4, start_ts: "2026-10-05T10:00:00Z", end_ts: "2026-10-05T11:00:00Z" },
      { id: 2, service_id: 4, start_ts: "2026-10-06T01:00:00Z", end_ts: "2026-10-06T02:00:00Z" }], error: null });
    await expect(fetchPublicServiceSlots(4)).resolves.toEqual([expect.objectContaining({ id: 2 })]);
  });
});
