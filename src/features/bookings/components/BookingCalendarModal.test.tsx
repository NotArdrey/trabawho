import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BookingCalendarModal from "./BookingCalendarModal";

const worker = { id: "provider-1", name: "Nina Mercado Flores", title: "Event Setup & Cleanup" };
const schedule = {
  operatingDays: ["Thu"],
  manualScheduling: false,
  dayBlocks: {
    Thu: [{ id: "midday", startTime: "12:00", endTime: "13:00", slotsLeft: 3 }],
  },
};

describe("BookingCalendarModal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-10T08:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("guides the user through date, time, review, and confirmation", async () => {
    const user = userEvent.setup();
    const onConfirmBooking = vi.fn();
    render(<BookingCalendarModal isOpen worker={worker} schedule={schedule} onClose={vi.fn()} onConfirmBooking={onConfirmBooking} />);

    expect(screen.getByRole("button", { name: "Review booking" })).toBeEnabled();
    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, 3 slots available/i }));
    await user.click(screen.getByRole("button", { name: /12:00 PM–1:00 PM/i }));
    await user.click(screen.getByRole("button", { name: "Review booking" }));

    expect(screen.getByRole("dialog", { name: "Confirm booking request" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Choose a booking schedule" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send booking request" }));
    expect(onConfirmBooking).toHaveBeenCalledWith({
      workerId: "provider-1",
      date: "2026-09-10",
      dayKey: "Thu",
      blockId: "midday",
      manualScheduling: false,
    });
  });

  it("clearly directs the user to select a required time", async () => {
    const user = userEvent.setup();
    render(<BookingCalendarModal isOpen worker={worker} schedule={schedule} onClose={vi.fn()} onConfirmBooking={vi.fn()} />);

    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, 3 slots available/i }));
    expect(screen.getByText("Required: select one of the available times above.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review booking" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select a time before reviewing your booking.");
    expect(screen.queryByRole("dialog", { name: "Confirm booking request" })).not.toBeInTheDocument();
  });

  it("closes through the shared dialog control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BookingCalendarModal isOpen worker={worker} schedule={schedule} onClose={onClose} onConfirmBooking={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
