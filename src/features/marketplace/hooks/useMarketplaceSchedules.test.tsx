import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, query } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn();
  return { from: vi.fn(() => chain), query: chain };
});

vi.mock("@/integrations/supabase", () => ({ supabase: { from } }));

import { useMarketplaceSchedules } from "./useMarketplaceSchedules";

describe("useMarketplaceSchedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.order.mockResolvedValue({ data: [], error: null });
  });

  it("only loads future public slots that remain available", async () => {
    const providers = [{ id: "provider-1", rawService: { id: 7 } }];
    renderHook(() => useMarketplaceSchedules(providers));

    await waitFor(() => expect(query.order).toHaveBeenCalled());
    expect(from).toHaveBeenCalledWith("service_slots");
    expect(query.eq).toHaveBeenCalledWith("status", "available");
    expect(query.eq).toHaveBeenCalledWith("visibility", "public");
    expect(query.gte).toHaveBeenCalledWith("start_ts", expect.any(String));
  });
});
