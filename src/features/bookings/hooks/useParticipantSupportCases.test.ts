import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listParticipantSupportCases, type ParticipantSupportCase } from "../services/participantSupportCases";
import { useParticipantSupportCases } from "./useParticipantSupportCases";

vi.mock("../services/participantSupportCases", () => ({ listParticipantSupportCases: vi.fn() }));
vi.mock("./useBookingActivity", () => ({ useBookingActivity: vi.fn() }));

describe("participant support case refresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps loaded cases visible without a loading state during background refresh", async () => {
    const cases = [{ report: { id: "case-1" }, serviceTitle: "Repair" }] as ParticipantSupportCase[];
    let finishRefresh: ((value: ParticipantSupportCase[]) => void) | undefined;
    vi.mocked(listParticipantSupportCases)
      .mockResolvedValueOnce(cases)
      .mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }));
    const { result } = renderHook(() => useParticipantSupportCases("client-1"));
    await waitFor(() => expect(result.current.items).toEqual(cases));
    expect(result.current.loading).toBe(false);
    let refresh: Promise<void> | undefined;
    act(() => { refresh = result.current.refresh(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual(cases);
    await act(async () => { finishRefresh?.(cases); await refresh; });
    expect(result.current.loading).toBe(false);
  });
});
