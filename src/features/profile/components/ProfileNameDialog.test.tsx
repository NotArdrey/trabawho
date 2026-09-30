import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileNameDialog } from "./ProfileNameDialog";

const props = {
  firstName: "Jose",
  isOpen: true,
  isSaving: false,
  lastName: "Ramos",
  middleName: "Miguel",
  onFirstNameChange: vi.fn(),
  onLastNameChange: vi.fn(),
  onMiddleNameChange: vi.fn(),
  onOpenChange: vi.fn(),
  onSave: vi.fn(),
};

describe("ProfileNameDialog", () => {
  it("uses labeled name fields and clear actions", () => {
    render(<ProfileNameDialog {...props} />);
    expect(screen.getByRole("heading", { name: "Edit profile name" })).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Jose");
    expect(screen.getByLabelText("Middle name")).toHaveValue("Miguel");
    expect(screen.getByLabelText("Last name")).toHaveValue("Ramos");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("submits changes and closes through cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSave = vi.fn();
    render(<ProfileNameDialog {...props} onOpenChange={onOpenChange} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requires a first and last name", () => {
    render(<ProfileNameDialog {...props} firstName="" />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});
