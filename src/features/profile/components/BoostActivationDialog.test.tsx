import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoostActivationDialog } from "./BoostActivationDialog";

describe("BoostActivationDialog", () => {
  it("shows the full budget without booking payment plans", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<BoostActivationDialog budget={250} days={7} isOpen isSaving={false} onCancel={vi.fn()} onConfirm={onConfirm} serviceTitle="Apartment Cleaning" />);

    expect(screen.getByRole("dialog", { name: "Review gig boost payment" })).toBeVisible();
    expect(screen.getByText("PHP 250")).toBeVisible();
    expect(screen.getByText(/starting after verified payment/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue to PayMongo" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continue to PayMongo" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
