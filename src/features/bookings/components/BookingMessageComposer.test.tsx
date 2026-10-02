import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingMessageComposer } from "./BookingMessageComposer";

describe("message composer", () => {
  it("prevents repeated Enter submissions and preserves a new draft while sending", async () => {
    let finish!: (saved: boolean) => void;
    const onSend = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    render(<BookingMessageComposer conversationId="one" hasQuote={false} isSending={false} onSend={onSend} />);
    const input = screen.getByRole("textbox", { name: "Message" });
    const form = screen.getByRole("form", { name: "Send a message" });
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSend).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: "next message" } });
    await act(async () => { finish(true); await Promise.resolve(); });
    expect(input).toHaveValue("next message");
  });

  it("retains the draft when sending fails", async () => {
    render(<BookingMessageComposer conversationId="one" hasQuote={false} isSending={false} onSend={vi.fn().mockResolvedValue(false)} />);
    const input = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(input, { target: { value: "retry me" } });
    await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Send a message" })); await Promise.resolve(); });
    expect(input).toHaveValue("retry me");
  });
});
