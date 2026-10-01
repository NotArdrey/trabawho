import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoostActivationDialog } from "./BoostActivationDialog";

describe("BoostActivationDialog", () => {
  it("shows the full demo budget without booking payment plans", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<BoostActivationDialog budget={250} days={7} isOpen isSaving={false} onCancel={vi.fn()} onConfirm={onConfirm} serviceTitle="Apartment Cleaning" />);

    expect(screen.getByRole("dialog", { name: "Activate demo gig boost" })).toBeVisible();
    expect(screen.getByText("PHP 250")).toBeVisible();
    expect(screen.getByText(/No card, GCash transfer, or real payment is collected/i)).toBeVisible();
    expect(screen.queryByText(/downpayment|PayMongo|after service/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Activate demo boost" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
