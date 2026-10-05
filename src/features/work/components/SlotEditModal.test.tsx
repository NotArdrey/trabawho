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
});
