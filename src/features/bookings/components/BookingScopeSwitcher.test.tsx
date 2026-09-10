import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BookingScopeSwitcher } from "./BookingScopeSwitcher";

describe("BookingScopeSwitcher", () => {
  it("uses a strong selected state and changes booking scope", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<BookingScopeSwitcher value="purchases" onValueChange={onValueChange} />);

    const selected = screen.getByRole("button", { name: "Services I booked" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveClass("bg-primary", "text-primary-foreground");

    await user.click(screen.getByRole("button", { name: "Incoming bookings" }));
    expect(onValueChange).toHaveBeenCalledWith("incoming");
  });
});
