import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InquiryChatModal from "./InquiryChatModal";

const bookingApi = vi.hoisted(() => ({
  fetchBookingMessages: vi.fn(),
  sendBookingMessage: vi.fn(),
}));
const quoteApi = vi.hoisted(() => ({ proposeBookingQuote: vi.fn(), fetchBookingById: vi.fn() }));

vi.mock("@/features/bookings", () => bookingApi);
vi.mock("@/features/bookings/services/bookingTransactions", () => ({ proposeBookingQuote: quoteApi.proposeBookingQuote }));
vi.mock("@/features/bookings/services/bookingService", () => ({ fetchBookingById: quoteApi.fetchBookingById }));

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
  quoteApi.proposeBookingQuote.mockReset().mockResolvedValue({ quote: { id: "quote-1" } });
  quoteApi.fetchBookingById.mockReset().mockResolvedValue({ id: "booking-1", status: "Negotiating", scheduleStatus: "unscheduled", paymentStatus: "unpaid" });
});

describe("InquiryChatModal", () => {
  it("supports a keyboard reply and exposes the empty conversation state", async () => {
    render(<InquiryChatModal inquiry={inquiry} onClose={vi.fn()} />);
    expect(screen.getByTestId("inquiry-response-dialog")).toHaveClass("max-w-[36rem]!");
    expect(await screen.findByText("Start the conversation")).toBeVisible();

    const reply = screen.getByLabelText("Reply to Joshua Santos");
    fireEvent.change(reply, { target: { value: "Available tomorrow." } });
    fireEvent.keyDown(reply, { key: "Enter" });
    fireEvent.keyDown(reply, { key: "Enter" });
    fireEvent.keyDown(reply, { key: "Enter" });

    await waitFor(() => expect(bookingApi.sendBookingMessage).toHaveBeenCalledWith(
      inquiry.booking,
      "Available tomorrow.",
    ));
    expect(bookingApi.sendBookingMessage).toHaveBeenCalledOnce();
  });

  it("prefills the client budget and sends a quote without stacking another dialog", async () => {
    const user = userEvent.setup();
    render(<InquiryChatModal inquiry={inquiry} onClose={vi.fn()} />);
    await screen.findByText("Start the conversation");

    await user.click(screen.getByRole("button", { name: "Create quote" }));
    expect(screen.getByLabelText("Service price (PHP)")).toHaveValue(900);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    await user.type(screen.getByLabelText("Included work"), "Labor and installation materials");
    fireEvent.change(screen.getByLabelText("Starts (PHT)"), { target: { value: "2099-10-06T10:00" } });
    fireEvent.change(screen.getByLabelText("Ends (PHT)"), { target: { value: "2099-10-06T11:00" } });
    await user.click(screen.getByRole("button", { name: "Review quote" }));
    await user.click(screen.getByRole("button", { name: "Send quote" }));

    await waitFor(() => expect(quoteApi.proposeBookingQuote).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: "booking-1", amount: 900, scopeSummary: "Labor and installation materials",
      startAt: "2099-10-06T02:00:00.000Z", endAt: "2099-10-06T03:00:00.000Z",
    })));
    expect(bookingApi.sendBookingMessage).not.toHaveBeenCalled();
  });
});
