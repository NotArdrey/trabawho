import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProviderQuoteAction } from "./ProviderQuoteAction";

const booking = { id: "booking-1", scheduleStatus: "unscheduled", paymentStatus: "unpaid",
  raw: { booking: { status: "pending" } } };

describe("ProviderQuoteAction", () => {
  it("starts with messages, opens an inline editor, and can close it at either step", async () => {
    const user = userEvent.setup();
    render(<ProviderQuoteAction booking={booking} viewerRole="seller" isRequestBooking
      isClosedConversation={false} onProposeQuote={vi.fn()} />);

    const action = screen.getByRole("button", { name: "Create quote" });
    expect(screen.queryByRole("region", { name: "Quote editor" })).not.toBeInTheDocument();
    await user.click(action);
    expect(screen.getByRole("region", { name: "Quote editor" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Back to messages" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Close quote editor" }));
    expect(screen.queryByRole("region", { name: "Quote editor" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create quote" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Create quote" }));
    await user.type(screen.getByRole("spinbutton", { name: "Service price (PHP)" }), "950");
    await user.type(screen.getByRole("textbox", { name: "Included work" }), "Garden cleanup");
    await user.type(screen.getByLabelText("Starts (PHT)"), "2099-10-06T10:00");
    await user.type(screen.getByLabelText("Ends (PHT)"), "2099-10-06T11:00");
    await user.click(screen.getByRole("button", { name: "Review quote" }));
    expect(screen.getByText("PHP 950.00")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back to messages" }));
    expect(screen.queryByRole("region", { name: "Quote editor" })).not.toBeInTheDocument();
  });

  it("does not offer a new quote to clients or for paid and closed requests", () => {
    const onProposeQuote = vi.fn();
    const { rerender } = render(<ProviderQuoteAction booking={booking} viewerRole="buyer" isRequestBooking
      isClosedConversation={false} onProposeQuote={onProposeQuote} />);
    expect(screen.queryByRole("button", { name: "Create quote" })).not.toBeInTheDocument();
    rerender(<ProviderQuoteAction booking={{ ...booking, paymentStatus: "paid" }} viewerRole="seller" isRequestBooking
      isClosedConversation={false} onProposeQuote={onProposeQuote} />);
    expect(screen.queryByRole("button", { name: "Create quote" })).not.toBeInTheDocument();
    rerender(<ProviderQuoteAction booking={{ ...booking, raw: { booking: { status: "cancelled" } } }}
      viewerRole="seller" isRequestBooking isClosedConversation={false} onProposeQuote={onProposeQuote} />);
    expect(screen.queryByRole("button", { name: "Create quote" })).not.toBeInTheDocument();
  });

  it("does not offer a booking quote in a standalone conversation", () => {
    render(<ProviderQuoteAction booking={{ id: "conversation:7b0b479a-4c4e-4dac-b061-dd3cc520bb35",
      bookingMode: "conversation", isStandaloneChat: true }} viewerRole="seller" isRequestBooking
      isClosedConversation={false} onProposeQuote={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Create quote" })).not.toBeInTheDocument();
    expect(screen.queryByText(/client must submit a booking request/i)).not.toBeInTheDocument();
  });
});
