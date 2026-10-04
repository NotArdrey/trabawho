import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChatScope } from "./useChatScope";

const options = { isWorker: true, isChat: true, isProviderRoute: false, requestedScope: null, selectedId: null, userId: "worker" };
describe("fixed account booking scope", () => {
  it("keeps Worker inbox and selected conversations incoming despite old purchase URLs", () => {
    const { result, rerender } = renderHook(({ selectedId, requestedScope }: { selectedId: string | null; requestedScope: string | null }) =>
      useChatScope({ ...options, selectedId, requestedScope }), { initialProps: { selectedId: null as string | null, requestedScope: null as string | null } });
    expect(result.current).toEqual({ activeScope: "incoming", isResolvingChatScope: false });
    rerender({ selectedId: "conversation:chat", requestedScope: "purchases" });
    expect(result.current).toEqual({ activeScope: "incoming", isResolvingChatScope: false });
    rerender({ selectedId: "booking", requestedScope: "purchases" });
    expect(result.current.activeScope).toBe("incoming");
  });
  it("keeps Client inbox and bookings in purchases despite incoming URLs", () => {
    const { result } = renderHook(() => useChatScope({ ...options, isWorker: false, isProviderRoute: true, requestedScope: "incoming", selectedId: "chat" }));
    expect(result.current).toEqual({ activeScope: "purchases", isResolvingChatScope: false });
  });
  it("updates scope when a separate account signs in", () => {
    const { result, rerender } = renderHook(({ isWorker }) => useChatScope({ ...options, isWorker }), { initialProps: { isWorker: true } });
    expect(result.current.activeScope).toBe("incoming");
    rerender({ isWorker: false });
    expect(result.current.activeScope).toBe("purchases");
  });
});
