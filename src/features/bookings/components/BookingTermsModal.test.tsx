import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BookingTermsModal from "./BookingTermsModal";

function ControlledTermsModal({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(true);
  return <BookingTermsModal isOpen={open} onCancel={() => setOpen(false)} onConfirm={onConfirm} />;
}

describe("BookingTermsModal", () => {
  it("closes immediately when Cancel is selected", async () => {
    const user = userEvent.setup();
    render(<ControlledTermsModal />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires explicit agreement before continuing", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ControlledTermsModal onConfirm={onConfirm} />);

    const continueButton = screen.getByRole("button", { name: "Agree and open checkout" });
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("presents the agreement as scannable booking decisions", () => {
    render(<ControlledTermsModal />);

    expect(screen.getByRole("heading", { name: "Review before payment" })).toBeVisible();
    expect(screen.getByText("15-minute reservation")).toBeVisible();
    expect(screen.getByText("Changes and cancellations")).toBeVisible();
    expect(screen.queryByText("Demo payment")).not.toBeInTheDocument();
  });
});
