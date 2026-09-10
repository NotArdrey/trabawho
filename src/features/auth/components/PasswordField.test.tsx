import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import PasswordField from "@/features/auth/components/PasswordField";

describe("PasswordField", () => {
  it("shows and hides the password without clearing its value", async () => {
    const user = userEvent.setup();
    render(<PasswordField id="password" label="Password" name="password" />);

    const input = screen.getByLabelText("Password");
    await user.type(input, "SecurePassword9");
    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("SecurePassword9");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });
});
