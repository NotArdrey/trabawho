import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPublicServiceSlots } from "@/features/bookings/services/bookingAvailability";
import SlotSelectionModal from "./SlotSelectionModal";

vi.mock("@/features/bookings/services/bookingAvailability", () => ({
  fetchPublicServiceSlots: vi.fn(),
}));

const mockedFetchSlots = vi.mocked(fetchPublicServiceSlots);

describe("SlotSelectionModal", () => {
  beforeEach(() => {
    mockedFetchSlots.mockResolvedValue([{
      booked_count: 1,
      capacity: 3,
      end_ts: "2026-10-10T10:00:00+08:00",
      id: 42,
      service_id: 7,
      start_ts: "2026-10-10T09:00:00+08:00",
    }]);
  });

  it("requires an explicit date and time before continuing", async () => {
    const user = userEvent.setup();
    const onConfirmSlot = vi.fn();
    render(<SlotSelectionModal booking={{ serviceId: 7, workerName: "Nina Flores" }} onCancel={vi.fn()} onConfirmSlot={onConfirmSlot} />);

    const reviewButton = await screen.findByRole("button", { name: "Review booking" });
    expect(reviewButton).toBeDisabled();
    expect(screen.getByText("Select a date and time to continue.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Sat, Oct 10/i }));
    expect(reviewButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /9:00 AM–10:00 AM/i }));
    expect(reviewButton).toBeEnabled();
    await user.click(reviewButton);

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
});
