import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSandboxCheckoutAvailable } from "./useSandboxCheckoutAvailable";

describe("sandbox checkout availability", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("discovers an explicitly enabled deployed test endpoint", async () => {
    vi.stubEnv("DEV", false);
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(useSandboxCheckoutAvailable);
    await waitFor(() => expect(result.current).toBe(true));
    expect(fetch).toHaveBeenCalledWith("/__trabawho_paymongo_sandbox_ready", expect.objectContaining({ cache: "no-store" }));
  });

  it("keeps the shortcut hidden when the deployed endpoint is unavailable", async () => {
    vi.stubEnv("DEV", false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(useSandboxCheckoutAvailable);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
