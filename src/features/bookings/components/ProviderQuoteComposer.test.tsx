import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProviderQuoteComposer } from "./ProviderQuoteComposer";
import type { QuoteProposalInput } from "./ProviderQuoteComposer";

function completeForm() {
  fireEvent.change(screen.getByLabelText("Service price (PHP)"), { target: { value: "950" } });
  fireEvent.change(screen.getByLabelText("Included work"), { target: { value: "Garden cleanup, excluding waste disposal" } });
  fireEvent.change(screen.getByLabelText("Starts (PHT)"), { target: { value: "2099-10-06T10:00" } });
  fireEvent.change(screen.getByLabelText("Ends (PHT)"), { target: { value: "2099-10-06T11:00" } });
}

describe("ProviderQuoteComposer", () => {
  it("reviews the price, scope, and Philippine time before sending", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProviderQuoteComposer onSubmit={onSubmit} />);
    completeForm();
    await user.click(screen.getByRole("button", { name: "Review quote" }));
    expect(screen.getByText("PHP 950.00")).toBeVisible();
    expect(screen.getByText(/Garden cleanup, excluding waste disposal/)).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Send quote" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      amount: 950, scopeSummary: "Garden cleanup, excluding waste disposal",
      startAt: "2099-10-06T02:00:00.000Z", endAt: "2099-10-06T03:00:00.000Z",
    })));
  });

  it("keeps the same operation ID and entered details after a failed send", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("The provider is already booked at that time.")).mockResolvedValueOnce(undefined);
    render(<ProviderQuoteComposer onSubmit={onSubmit} />);
    completeForm();
    await user.click(screen.getByRole("button", { name: "Review quote" }));
    await user.click(screen.getByRole("button", { name: "Send quote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already booked");
    await user.click(screen.getByRole("button", { name: "Send quote" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    const calls = onSubmit.mock.calls as unknown as Array<[QuoteProposalInput]>;
    expect(calls[1][0].operationId).toBe(calls[0][0].operationId);
  });
});
