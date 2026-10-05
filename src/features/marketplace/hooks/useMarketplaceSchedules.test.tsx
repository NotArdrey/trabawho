import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase", () => ({ supabase: { rpc } }));

import { useMarketplaceSchedules } from "./useMarketplaceSchedules";

describe("useMarketplaceSchedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it("only loads future public slots that remain available", async () => {
    const providers = [{ id: "provider-1", rawService: { id: 7 } }];
    renderHook(() => useMarketplaceSchedules(providers));

    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith("list_available_service_slots", { p_service_ids: [7] });
  });
});
