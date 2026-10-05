import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuoteResponseDialog } from "./QuoteResponseDialog";

describe("QuoteResponseDialog", () => {
  it("requires feedback before requesting changes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuoteResponseDialog action="request_changes" onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Send change request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tell the provider");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("What should change?"), "Please start one hour later.");
    await user.click(screen.getByRole("button", { name: "Send change request" }));
    expect(onSubmit).toHaveBeenCalledWith("request_changes", "Please start one hour later.");
  });

  it("confirms that declining closes the request", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuoteResponseDialog action="decline" onClose={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByText(/ends the unpaid booking request/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Decline and close" }));
    expect(onSubmit).toHaveBeenCalledWith("decline", "");
  });
});
