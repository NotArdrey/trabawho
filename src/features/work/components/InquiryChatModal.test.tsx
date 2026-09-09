import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InquiryChatModal from "./InquiryChatModal";

const bookingApi = vi.hoisted(() => ({
  fetchBookingMessages: vi.fn(),
  sendBookingMessage: vi.fn(),
  updateBookingWorkflow: vi.fn(),
}));

vi.mock("@/features/bookings", () => bookingApi);

const inquiry = {
  booking: { id: "booking-1" },
  clientName: "Joshua Santos",
  description: "Install and test a ceiling fan.",
  id: "inquiry-1",
  messages: 0,
  proposedBudget: "PHP 900",
  service: "Appliance Installation & Repair",
  status: "Pending Response",
};

beforeEach(() => {
  bookingApi.fetchBookingMessages.mockReset().mockResolvedValue([]);
  bookingApi.sendBookingMessage.mockReset().mockResolvedValue({
    id: "message-1",
    sender: "worker",
    content: "Available tomorrow.",
    timestamp: "Now",
  });
  bookingApi.updateBookingWorkflow.mockReset().mockResolvedValue({ id: "booking-1" });
});

describe("InquiryChatModal", () => {
  it("supports a keyboard reply and exposes the empty conversation state", async () => {
    render(<InquiryChatModal inquiry={inquiry} onClose={vi.fn()} />);
    expect(await screen.findByText("Start the conversation")).toBeVisible();

    const reply = screen.getByLabelText("Reply to Joshua Santos");
    fireEvent.change(reply, { target: { value: "Available tomorrow." } });
    fireEvent.keyDown(reply, { key: "Enter" });

    await waitFor(() => expect(bookingApi.sendBookingMessage).toHaveBeenCalledWith(
      inquiry.booking,
      "Available tomorrow.",
    ));
  });

  it("prefills the client budget and sends a quote without stacking another dialog", async () => {
    const user = userEvent.setup();
    render(<InquiryChatModal inquiry={inquiry} onClose={vi.fn()} />);
    await screen.findByText("Start the conversation");

    await user.click(screen.getByRole("button", { name: "Create quote" }));
    expect(screen.getByLabelText("Amount (PHP)")).toHaveValue("900");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    await user.type(screen.getByLabelText(/Scope and inclusions/), "Labor and installation materials");
    await user.click(screen.getByRole("button", { name: "Send quote" }));

    await waitFor(() => expect(bookingApi.updateBookingWorkflow).toHaveBeenCalledWith(
      inquiry.booking,
      expect.objectContaining({ quoteAmount: 900 }),
    ));
    expect(bookingApi.sendBookingMessage).toHaveBeenCalledWith(
      inquiry.booking,
      "Labor and installation materials",
      expect.objectContaining({ type: "quote", amount: 900 }),
    );
  });
});
