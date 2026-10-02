import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBookingConversation, type ConversationMessage } from "./useBookingConversation";

const { fetchMessages, sendMessage } = vi.hoisted(() => ({ fetchMessages: vi.fn(), sendMessage: vi.fn() }));
vi.mock("@/features/bookings/services/bookingService", () => ({
  fetchBookingMessages: fetchMessages, sendBookingMessage: sendMessage,
}));
const message = (id: string): ConversationMessage => ({ id, sender: "client", type: "text", content: id });

describe("booking conversation", () => {
  beforeEach(() => { vi.resetAllMocks(); fetchMessages.mockResolvedValue([]); });
  afterEach(() => { vi.useRealTimers(); });

  it("allows one send while pending and preserves it when an earlier fetch finishes", async () => {
    let finishFetch!: (rows: ConversationMessage[]) => void;
    let finishSend!: (row: ConversationMessage) => void;
    fetchMessages.mockReturnValue(new Promise((resolve) => { finishFetch = resolve; }));
    sendMessage.mockReturnValue(new Promise((resolve) => { finishSend = resolve; }));
    const { result } = renderHook(() => useBookingConversation({ id: "one" }));
    let sending!: Promise<boolean>;
    act(() => { sending = result.current.send("hello"); });
    await act(async () => { expect(await result.current.send("hello")).toBe(false); });
    expect(sendMessage).toHaveBeenCalledOnce();
    await act(async () => { finishSend(message("new")); await sending; });
    await act(async () => { finishFetch([message("old")]); await Promise.resolve(); });
    expect(result.current.messages.map((row) => row.id)).toEqual(["old", "new"]);
    expect(result.current.isSending).toBe(false);
  });

  it("receives messages without a reload and deduplicates a sent message", async () => {
    vi.useFakeTimers();
    fetchMessages.mockResolvedValue([message("one")]);
    const { result } = renderHook(() => useBookingConversation({ id: "one" }));
    await act(async () => { await Promise.resolve(); });
    fetchMessages.mockResolvedValue([message("one"), message("two")]);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.messages.map((row) => row.id)).toEqual(["one", "two"]);
    sendMessage.mockResolvedValue(message("two"));
    await act(async () => { await result.current.send("two"); });
    expect(result.current.messages).toHaveLength(2);
  });

  it("keeps a late send out of a newly selected conversation", async () => {
    let finishSend!: (row: ConversationMessage) => void;
    sendMessage.mockReturnValue(new Promise((resolve) => { finishSend = resolve; }));
    const { result, rerender } = renderHook(({ id }) => useBookingConversation({ id }), { initialProps: { id: "one" } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let sending!: Promise<boolean>;
    act(() => { sending = result.current.send("hello"); });
    rerender({ id: "two" });
    await act(async () => { finishSend(message("old-thread")); expect(await sending).toBe(false); });
    expect(result.current.messages).toEqual([]);
  });
});
