import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BookingCalendarModal from "./BookingCalendarModal";

const availability = vi.hoisted(() => ({ fetchPublicServiceSlots: vi.fn() }));
vi.mock("@/features/bookings/services/bookingAvailability", () => availability);

const worker = { id: "provider-1", name: "Nina Mercado Flores", title: "Event Setup & Cleanup" };
const schedule = {
  operatingDays: ["Thu"],
  manualScheduling: false,
  dayBlocks: {
    "2026-09-10": [{ id: "midday", startTime: "12:00", endTime: "13:00", slotsLeft: 1 }],
  },
};

describe("BookingCalendarModal", () => {
  beforeEach(() => {
    availability.fetchPublicServiceSlots.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-09T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("guides the user through date, time, review, and confirmation", async () => {
    const user = userEvent.setup();
    const onConfirmBooking = vi.fn();
    render(<BookingCalendarModal isOpen worker={worker} schedule={schedule} onClose={vi.fn()} onConfirmBooking={onConfirmBooking} />);

    expect(screen.getByRole("button", { name: "Review booking" })).toBeEnabled();
    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, 1 slot available/i }));
    await user.click(screen.getByRole("button", { name: /12:00 PM–1:00 PM/i }));
    await user.click(screen.getByRole("button", { name: "Review booking" }));

    expect(screen.getByRole("dialog", { name: "Review booking schedule" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Choose a booking schedule" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to payment" }));
    expect(onConfirmBooking).toHaveBeenCalledWith(expect.objectContaining({
      workerId: "provider-1",
      date: "2026-09-10",
      dayKey: "Thu",
      blockId: "midday",
      manualScheduling: false,
    }));
  });

  it("clearly directs the user to select a required time", async () => {
    const user = userEvent.setup();
    render(<BookingCalendarModal isOpen worker={worker} schedule={schedule} onClose={vi.fn()} onConfirmBooking={vi.fn()} />);

    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, 1 slot available/i }));
    expect(screen.getByText("Required: select one of the available times above.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review booking" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select a time before reviewing your booking.");
    expect(screen.queryByRole("dialog", { name: "Review booking schedule" })).not.toBeInTheDocument();
  });

  it("closes through the shared dialog control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BookingCalendarModal isOpen worker={worker} schedule={schedule} onClose={onClose} onConfirmBooking={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("distinguishes missing availability from fully booked dates", () => {
    render(
      <BookingCalendarModal
        isOpen
        worker={worker}
        schedule={{ operatingDays: [], manualScheduling: false, dayBlocks: {} }}
        onClose={vi.fn()}
        onConfirmBooking={vi.fn()}
      />,
    );

    expect(screen.getByText("No booking slots are available right now")).toBeInTheDocument();
    expect(screen.getAllByText("No times").length).toBeGreaterThan(0);
    expect(screen.queryByText("Full")).not.toBeInTheDocument();
  });

  it("offers one time when legacy rows repeat the same window", async () => {
    const user = userEvent.setup();
    render(<BookingCalendarModal isOpen worker={worker} schedule={{ manualScheduling: false, operatingDays: ["Thu"],
      dayBlocks: { "2026-09-10": ["first", "duplicate"].map((id) => ({ id, startTime: "09:00", endTime: "10:00", slotsLeft: 1 })) },
    }} onClose={vi.fn()} onConfirmBooking={vi.fn()} />);
    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, 1 slot available/i }));
    expect(screen.getAllByRole("button", { name: /9:00 AM.*10:00 AM/i })).toHaveLength(1);
  });

  it("disables the whole current Philippine date, including later hours", () => {
    vi.setSystemTime(new Date("2026-09-10T09:00:00Z"));
    render(<BookingCalendarModal isOpen worker={worker} schedule={schedule} onClose={vi.fn()} onConfirmBooking={vi.fn()} />);
    expect(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, booking available from tomorrow onward/i })).toBeDisabled();
    expect(screen.getByText("Choose a date from tomorrow onward, Philippine time.")).toBeVisible();
  });

  it("does not borrow next week's weekday slot for a date with no availability", async () => {
    const user = userEvent.setup();
    const slot = { id: 17, service_id: 7, start_ts: "2026-09-17T05:00:00Z", end_ts: "2026-09-17T06:00:00Z", capacity: 1, booked_count: 0 };
    availability.fetchPublicServiceSlots.mockResolvedValue([slot]);
    render(<BookingCalendarModal isOpen worker={{ ...worker, rawService: { id: 7 } }} schedule={{ operatingDays: ["Thu"], dayBlocks: {
      Thu: [{ id: 17, startTime: "13:00", endTime: "14:00", slotsLeft: 1, rawSlot: slot }],
      "2026-09-17": [{ id: 17, startTime: "13:00", endTime: "14:00", slotsLeft: 1, rawSlot: slot }],
    } }} onClose={vi.fn()} onConfirmBooking={vi.fn()} />);

    await waitFor(() => expect(availability.fetchPublicServiceSlots).toHaveBeenCalledOnce());
    expect(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, no times offered/i })).toBeDisabled();
    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 17, 2026, 1 slot available/i }));
    expect(screen.getByRole("button", { name: /1:00 PM.*2:00 PM/i })).toBeEnabled();
  });

  it("disables a date when its only slot belongs to another Philippine date", async () => {
    const slot = { id: 17, service_id: 7, start_ts: "2026-09-17T05:00:00Z", end_ts: "2026-09-17T06:00:00Z", capacity: 1, booked_count: 0 };
    availability.fetchPublicServiceSlots.mockResolvedValue([slot]);
    render(<BookingCalendarModal isOpen worker={{ ...worker, rawService: { id: 7 } }} schedule={{ dayBlocks: {
      "2026-09-10": [{ id: 17, startTime: "13:00", endTime: "14:00", slotsLeft: 1, rawSlot: slot }],
    } }} onClose={vi.fn()} onConfirmBooking={vi.fn()} />);

    await waitFor(() => expect(availability.fetchPublicServiceSlots).toHaveBeenCalledOnce());
    expect(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, no times offered/i })).toBeDisabled();
  });

  it("hides an already reserved time while leaving another time on the same date selectable", async () => {
    const user = userEvent.setup();
    const slot = { id: 11, service_id: 7, start_ts: "2026-09-10T02:00:00Z", end_ts: "2026-09-10T03:00:00Z", capacity: 1, booked_count: 0 };
    availability.fetchPublicServiceSlots.mockResolvedValue([slot]);
    render(<BookingCalendarModal isOpen worker={{ ...worker, rawService: { id: 7 } }} schedule={{ dayBlocks: { "2026-09-10": [
      { id: "claimed", startTime: "09:00", endTime: "10:00", slotsLeft: 1, rawSlot: { id: 10, start_ts: "2026-09-10T01:00:00Z", end_ts: "2026-09-10T02:00:00Z" } },
      { id: "free", startTime: "10:00", endTime: "11:00", slotsLeft: 1, rawSlot: slot },
    ] } }} onClose={vi.fn()} onConfirmBooking={vi.fn()} />);

    await waitFor(() => expect(screen.queryByRole("status", { name: /checking/i })).not.toBeInTheDocument());
    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, 1 slot available/i }));
    expect(screen.getByRole("button", { name: /9:00 AM.*10:00 AM.*Unavailable/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /10:00 AM.*11:00 AM/i })).toBeEnabled();
  });

  it("stops review if another client reserves the selected time", async () => {
    const user = userEvent.setup();
    const slot = { id: 11, service_id: 7, start_ts: "2026-09-10T02:00:00Z", end_ts: "2026-09-10T03:00:00Z", capacity: 1, booked_count: 0 };
    availability.fetchPublicServiceSlots.mockResolvedValueOnce([slot]).mockResolvedValueOnce([]);
    const onConfirmBooking = vi.fn();
    render(<BookingCalendarModal isOpen worker={{ ...worker, rawService: { id: 7 } }} schedule={{ dayBlocks: { "2026-09-10": [
      { id: "free", startTime: "10:00", endTime: "11:00", slotsLeft: 1, rawSlot: slot },
    ] } }} onClose={vi.fn()} onConfirmBooking={onConfirmBooking} />);

    await waitFor(() => expect(availability.fetchPublicServiceSlots).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, 1 slot available/i }));
    await user.click(screen.getByRole("button", { name: /10:00 AM.*11:00 AM/i }));
    await user.click(screen.getByRole("button", { name: "Review booking" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That time was just reserved");
    expect(screen.queryByRole("dialog", { name: "Review booking schedule" })).not.toBeInTheDocument();
    expect(onConfirmBooking).not.toHaveBeenCalled();
  });

  it("rechecks after review and blocks final confirmation when the time is claimed", async () => {
    const user = userEvent.setup();
    const slot = { id: 11, service_id: 7, start_ts: "2026-09-10T02:00:00Z", end_ts: "2026-09-10T03:00:00Z", capacity: 1, booked_count: 0 };
    availability.fetchPublicServiceSlots.mockResolvedValueOnce([slot]).mockResolvedValueOnce([slot]).mockResolvedValueOnce([]);
    const onConfirmBooking = vi.fn();
    render(<BookingCalendarModal isOpen worker={{ ...worker, rawService: { id: 7 } }} schedule={{ dayBlocks: { "2026-09-10": [
      { id: "free", startTime: "10:00", endTime: "11:00", slotsLeft: 1, rawSlot: slot },
    ] } }} onClose={vi.fn()} onConfirmBooking={onConfirmBooking} />);

    await waitFor(() => expect(availability.fetchPublicServiceSlots).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("gridcell", { name: /Thursday, September 10, 2026, 1 slot available/i }));
    await user.click(screen.getByRole("button", { name: /10:00 AM.*11:00 AM/i }));
    await user.click(screen.getByRole("button", { name: "Review booking" }));
    expect(await screen.findByRole("dialog", { name: "Review booking schedule" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to payment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That time was just reserved");
    expect(onConfirmBooking).not.toHaveBeenCalled();
  });
});
