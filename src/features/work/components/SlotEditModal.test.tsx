import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SlotEditModal from "./SlotEditModal";

describe("time slot editor", () => {
  it("saves one booking per slot across a provider's services", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SlotEditModal isOpen mode="with-slots" dayLabel="Monday" onClose={vi.fn()} onSave={onSave}
      slotData={{ startTime: "09:00", endTime: "10:00", capacity: 3 }} />);
    expect(screen.getByText(/one booking at a time across all your services/i)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Slot capacity" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ startTime: "09:00", endTime: "10:00", capacity: 1 }));
  });

  it("rejects duplicate and overlapping times while allowing adjacent windows", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<SlotEditModal isOpen mode="with-slots" dayLabel="Monday" onClose={vi.fn()} onSave={onSave}
      existingEntries={[{ id: 7, startTime: "09:00", endTime: "10:00" }]}
      slotData={{ startTime: "09:00", endTime: "10:00" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/overlaps an existing slot/i);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ startTime: "10:00", endTime: "11:00", capacity: 1 }));
  });

  it("allows editing the existing slot but not creating the same available date twice", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const view = render(<SlotEditModal isOpen mode="with-slots" dayLabel="Monday" onClose={vi.fn()} onSave={onSave}
      existingEntries={[{ id: 7, startTime: "09:00", endTime: "10:00" }]}
      slotData={{ id: 7, startTime: "09:00", endTime: "10:00" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    view.unmount();
    onSave.mockClear();
    render(<SlotEditModal isOpen mode="calendar-only" onClose={vi.fn()} onSave={onSave}
      existingEntries={[{ id: 8, date: "2026-10-05" }]} slotData={{ date: "2026-10-05" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/already available/i);
    expect(onSave).not.toHaveBeenCalled();
  });
});
