import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatScope } from "./useChatScope";

const { booking, conversation } = vi.hoisted(() => ({ booking: vi.fn(), conversation: vi.fn() }));
vi.mock("@/features/bookings/services/bookingService", () => ({ fetchBookingById: booking, fetchConversationById: conversation }));
const options = { isWorker: true, isChat: true, isProviderRoute: false, requestedScope: null, selectedId: null, userId: "worker" };
describe("chat scope", () => {
  beforeEach(() => { vi.resetAllMocks(); booking.mockResolvedValue(null); conversation.mockResolvedValue(null); });
  it("loads incoming messages when a worker opens the inbox without a selection", () => {
    const { result } = renderHook(() => useChatScope(options));
    expect(result.current).toEqual({ activeScope: "incoming", isResolvingChatScope: false });
  });
  it("resolves standalone conversations as incoming", async () => {
    conversation.mockResolvedValue({ sellerId: "worker" });
    const { result } = renderHook(() => useChatScope({ ...options, selectedId: "chat" }));
    await waitFor(() => expect(result.current.isResolvingChatScope).toBe(false));
    expect(conversation).toHaveBeenCalledWith("chat");
    expect(result.current.activeScope).toBe("incoming");
  });
  it("re-resolves the scope when the selected chat changes", async () => {
    booking.mockResolvedValue({ workerId: "other-provider" });
    const { result, rerender } = renderHook(({ selectedId }) => useChatScope({ ...options, selectedId }), { initialProps: { selectedId: "purchase" } });
    await waitFor(() => expect(result.current.activeScope).toBe("purchases"));
    booking.mockResolvedValue({ workerId: "worker" });
    rerender({ selectedId: "incoming" });
    await waitFor(() => expect(result.current.isResolvingChatScope).toBe(false));
    expect(result.current.activeScope).toBe("incoming");
  });
  it("resolves prefixed standalone IDs without querying them as booking UUIDs", async () => {
    conversation.mockResolvedValue({ sellerId: "worker" });
    const { result } = renderHook(() => useChatScope({ ...options, selectedId: "conversation:chat" }));
    await waitFor(() => expect(result.current.isResolvingChatScope).toBe(false));
    expect(booking).not.toHaveBeenCalled();
    expect(conversation).toHaveBeenCalledWith("chat");
    expect(result.current.activeScope).toBe("incoming");
  });
  it("honors explicit purchases and keeps client accounts in their own inbox", () => {
    const { result, rerender } = renderHook(({ isWorker }) => useChatScope({ ...options, isWorker, requestedScope: "purchases" }), { initialProps: { isWorker: true } });
    expect(result.current.activeScope).toBe("purchases");
    rerender({ isWorker: false });
    expect(result.current.activeScope).toBe("purchases");
    expect(booking).not.toHaveBeenCalled();
  });
});
