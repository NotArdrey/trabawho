import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfilePhotoDialog } from "./ProfilePhotoDialog";

const defaultProps = {
  hasPhoto: true,
  photoUrl: "https://example.com/my-photo.jpg",
  isOpen: true,
  isSaving: false,
  onImageSelection: vi.fn(),
  onOpenChange: vi.fn(),
  onRemovePhoto: vi.fn(),
};

describe("ProfilePhotoDialog", () => {
  it("presents clearly separated photo source choices", () => {
    render(<ProfilePhotoDialog {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Change profile photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take a photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose from device/i })).toBeInTheDocument();
    expect(screen.getByText(/maximum file size is 2 mb/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Your current profile photo" })).toHaveAttribute("src", defaultProps.photoUrl);
  });

  it("shows a larger current photo in the dialog and can hide it again", async () => {
    const user = userEvent.setup();
    render(<ProfilePhotoDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "View larger" }));
    expect(screen.getByRole("img", { name: "Your current profile, enlarged" })).toHaveAttribute("src", defaultProps.photoUrl);
    expect(screen.getByRole("button", { name: "Hide larger view" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Hide larger view" }));
    expect(screen.queryByRole("img", { name: "Your current profile, enlarged" })).not.toBeInTheDocument();
  });

  it("shows the default image without photo-only actions when no photo was uploaded", () => {
    render(<ProfilePhotoDialog {...defaultProps} hasPhoto={false} photoUrl="/default-profile.svg" />);

    expect(screen.getByRole("img", { name: "Default profile image" })).toHaveAttribute("src", "/default-profile.svg");
    expect(screen.queryByRole("button", { name: "View larger" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
  });

  it("forwards a selected device image", () => {
    const onImageSelection = vi.fn();
    render(<ProfilePhotoDialog {...defaultProps} onImageSelection={onImageSelection} />);
    const file = new File(["photo"], "profile.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText("Choose a profile photo from device"), {
      target: { files: [file] },
    });

    expect(onImageSelection).toHaveBeenCalledOnce();
  });

  it("keeps removal separate and closes through the cancel action", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onRemovePhoto = vi.fn();
    render(
      <ProfilePhotoDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onRemovePhoto={onRemovePhoto}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(onRemovePhoto).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
