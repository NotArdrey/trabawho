import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PasswordRecoveryPage from "@/features/auth/pages/PasswordRecoveryPage";
import { completePasswordRecovery } from "@/features/auth/services/password-recovery";

vi.mock("@/features/auth/services/password-recovery", () => ({
  completePasswordRecovery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

describe("PasswordRecoveryPage", () => {
  beforeEach(() => {
    vi.mocked(completePasswordRecovery).mockReset();
  });

  it("shows corrective validation without submitting malformed values", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PasswordRecoveryPage /></MemoryRouter>);

    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm new password"), "different");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Enter at least 8 characters.")).toBeInTheDocument();
    expect(completePasswordRecovery).not.toHaveBeenCalled();
  });

  it("submits a valid password through the recovery service", async () => {
    const user = userEvent.setup();
    vi.mocked(completePasswordRecovery).mockResolvedValue();
    render(<MemoryRouter><PasswordRecoveryPage /></MemoryRouter>);

    await user.type(screen.getByLabelText("New password"), "Professional9");
    await user.type(screen.getByLabelText("Confirm new password"), "Professional9");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(completePasswordRecovery).toHaveBeenCalledWith("Professional9"));
  });

  it("reveals each password field independently", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PasswordRecoveryPage /></MemoryRouter>);

    const password = screen.getByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show confirm password" }));
    expect(confirmation).toHaveAttribute("type", "text");
  });
});
