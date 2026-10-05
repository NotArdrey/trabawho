import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPublicServiceSlots } from "@/features/bookings/services/bookingAvailability";
import BookingTermsModal from "./BookingTermsModal";
import SlotSelectionModal from "./SlotSelectionModal";

vi.mock("@/features/bookings/services/bookingAvailability", () => ({
  fetchPublicServiceSlots: vi.fn(),
}));

const mockedFetchSlots = vi.mocked(fetchPublicServiceSlots);

function BookingFlowHarness() {
  const [step, setStep] = useState<"slots" | "terms" | "payment">("slots");
  return <>
    {step === "slots" ? <SlotSelectionModal booking={{ serviceId: 7, workerName: "Nina Flores" }} onCancel={() => setStep("payment")} onConfirmSlot={() => setStep("terms")} /> : null}
    <BookingTermsModal isOpen={step === "terms"} onCancel={() => setStep("slots")} onConfirm={() => setStep("payment")} />
    {step === "payment" ? <div role="status">Payment step ready</div> : null}
  </>;
}

describe("SlotSelectionModal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-05T09:00:00Z"));
    mockedFetchSlots.mockResolvedValue([{
      booked_count: 1,
      capacity: 3,
      end_ts: "2026-10-10T10:00:00+08:00",
      id: 42,
      service_id: 7,
      start_ts: "2026-10-10T09:00:00+08:00",
    }]);
  });
  afterEach(() => vi.useRealTimers());

  it("hides today's expired and later slots at 5 PM Philippine time", async () => {
    mockedFetchSlots.mockResolvedValue([
      { booked_count: 0, capacity: 1, id: 1, service_id: 7, start_ts: "2026-10-05T09:00:00+08:00", end_ts: "2026-10-05T10:00:00+08:00" },
      { booked_count: 0, capacity: 1, id: 2, service_id: 7, start_ts: "2026-10-05T18:00:00+08:00", end_ts: "2026-10-05T19:00:00+08:00" },
      { booked_count: 0, capacity: 1, id: 3, service_id: 7, start_ts: "2026-10-06T09:00:00+08:00", end_ts: "2026-10-06T10:00:00+08:00" },
    ]);
    render(<SlotSelectionModal booking={{ serviceId: 7 }} onCancel={vi.fn()} onConfirmSlot={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /Tue, Oct 6/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Mon, Oct 5/i })).not.toBeInTheDocument();
  });

  it("clears a selected time when the modal remains open past Philippine midnight", async () => {
    vi.setSystemTime(new Date("2026-10-05T15:59:00Z"));
    const user = userEvent.setup();
    mockedFetchSlots.mockResolvedValue([{ booked_count: 0, capacity: 1, id: 3, service_id: 7,
      start_ts: "2026-10-06T09:00:00+08:00", end_ts: "2026-10-06T10:00:00+08:00" }]);
    render(<SlotSelectionModal booking={{ serviceId: 7 }} onCancel={vi.fn()} onConfirmSlot={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /Tue, Oct 6/i }));
    await user.click(screen.getByRole("button", { name: /9:00 AM.*10:00 AM/i }));
    expect(screen.getByRole("button", { name: "Review booking" })).toBeEnabled();
    act(() => { vi.setSystemTime(new Date("2026-10-05T16:01:00Z")); window.dispatchEvent(new Event("focus")); });
    expect(screen.getByRole("button", { name: "Review booking" })).toBeDisabled();
    expect(screen.getByText(/No times are available right now/i)).toBeVisible();
  });

  it("requires an explicit date and time before continuing", async () => {
    const user = userEvent.setup();
    const onConfirmSlot = vi.fn();
    render(<SlotSelectionModal booking={{ serviceId: 7, serviceType: "Home cleaning", workerName: "Nina Flores", quoteAmount: 600 }} onCancel={vi.fn()} onConfirmSlot={onConfirmSlot} />);

    const reviewButton = await screen.findByRole("button", { name: "Review booking" });
    expect(reviewButton).toBeDisabled();
    expect(screen.getByText("Select a date and time to continue.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Sat, Oct 10/i }));
    expect(reviewButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /9:00 AM–10:00 AM/i }));
    expect(reviewButton).toBeEnabled();
    await user.click(reviewButton);

    expect(screen.getByRole("heading", { name: "Review your booking" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Booking review" })).toHaveTextContent("Home cleaning");
    expect(screen.getByRole("region", { name: "Booking review" })).toHaveTextContent("PHP 600");
    expect(onConfirmSlot).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Change time" }));
    expect(screen.getByRole("heading", { name: "Choose a booking schedule" })).toBeVisible();
    await user.click(reviewButton);
    await user.click(screen.getByRole("button", { name: "Continue to terms" }));

    expect(onConfirmSlot).toHaveBeenCalledWith(expect.objectContaining({ slotId: 42, date: "2026-10-10" }));
  });

  it("shows a short page of dates and lets people browse later availability", async () => {
    const user = userEvent.setup();
    mockedFetchSlots.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({
      booked_count: 0,
      capacity: 3,
      end_ts: `2026-10-${String(index + 11).padStart(2, "0")}T10:00:00+08:00`,
      id: index + 1,
      service_id: 7,
      start_ts: `2026-10-${String(index + 11).padStart(2, "0")}T09:00:00+08:00`,
    })));

    render(<SlotSelectionModal booking={{ serviceId: 7 }} onCancel={vi.fn()} onConfirmSlot={vi.fn()} />);

    expect(await screen.findByText("Showing 1–6 of 8 available dates")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Sat, Oct 17/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next dates" }));
    expect(screen.getByText("Showing 7–8 of 8 available dates")).toBeVisible();
    expect(screen.getByRole("button", { name: /Sat, Oct 17/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "Review booking" })).toBeDisabled();
  });

  it("opens terms after review and reaches payment", async () => {
    const user = userEvent.setup();
    render(<BookingFlowHarness />);

    await user.click(await screen.findByRole("button", { name: /Sat, Oct 10/i }));
    await user.click(screen.getByRole("button", { name: /9:00 AM–10:00 AM/i }));
    await user.click(screen.getByRole("button", { name: "Review booking" }));
    expect(screen.getByRole("heading", { name: "Review your booking" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue to terms" }));
    expect(screen.getByRole("heading", { name: "Review before payment" })).toBeVisible();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Agree and open checkout" }));
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Payment step ready");
  });

  it("labels rescheduling accurately and keeps a backend failure visible", async () => {
    const user = userEvent.setup();
    render(<SlotSelectionModal action="reschedule" booking={{ serviceId: 7 }} onCancel={vi.fn()} onConfirmSlot={vi.fn().mockRejectedValue(new Error("This booking can no longer be rescheduled"))} />);

    await user.click(await screen.findByRole("button", { name: /Sat, Oct 10/i }));
    await user.click(screen.getByRole("button", { name: /9:00 AM–10:00 AM/i }));
    await user.click(screen.getByRole("button", { name: "Review booking" }));
    await user.click(screen.getByRole("button", { name: "Request reschedule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This booking can no longer be rescheduled");
  });

  it("blocks a slot taken by another booking while the chooser was open", async () => {
    const user = userEvent.setup();
    const onConfirmSlot = vi.fn();
    mockedFetchSlots.mockResolvedValueOnce([{ booked_count: 0, capacity: 1, id: 42,
      service_id: 7, start_ts: "2026-10-10T09:00:00+08:00", end_ts: "2026-10-10T10:00:00+08:00" }])
      .mockResolvedValueOnce([]);
    render(<SlotSelectionModal booking={{ serviceId: 7 }} onCancel={vi.fn()} onConfirmSlot={onConfirmSlot} />);
    await user.click(await screen.findByRole("button", { name: /Sat, Oct 10/i }));
    await user.click(screen.getByRole("button", { name: /9:00 AM.*10:00 AM/i }));
    await user.click(screen.getByRole("button", { name: "Review booking" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That time was just booked or changed");
    expect(screen.queryByRole("heading", { name: "Review your booking" })).not.toBeInTheDocument();
    expect(onConfirmSlot).not.toHaveBeenCalled();
  });
});
