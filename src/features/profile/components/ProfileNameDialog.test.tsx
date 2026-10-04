import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileNameDialog } from "./ProfileNameDialog";

const props = {
  firstName: "Jose",
  isOpen: true,
  lastName: "Ramos",
  middleName: "Miguel",
  onOpenChange: vi.fn(),
};

describe("ProfileNameDialog", () => {
  it("shows the protected name without edit fields", () => {
    render(<ProfileNameDialog {...props} />);
    expect(screen.getByRole("heading", { name: "Profile name is protected" })).toBeInTheDocument();
    expect(screen.getByText("Jose Miguel Ramos")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("closes the informational dialog", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ProfileNameDialog {...props} onOpenChange={onOpenChange} />);
    await user.click(screen.getByText("Close", { selector: "button" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
