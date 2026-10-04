import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AccountPrivacyPanel from "./AccountPrivacyPanel";

const profile = {
  email: "jose@example.test",
  firstName: "Jose",
  lastName: "Ramos",
  phoneNumber: "09171234567",
};

const location = {
  address: "San Roque",
  barangay: "San Roque",
  city: "Baliuag",
  province: "Bulacan",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AccountPrivacyPanel", () => {
  it("locks account names while saving contact and location only", async () => {
    const user = userEvent.setup();
    const onUpdateProfile = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));

    render(<AccountPrivacyPanel sellerProfile={profile} userLocation={location} onUpdateProfile={onUpdateProfile} />);

    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Account & privacy/i }));
    expect(screen.getByLabelText("First name")).toHaveValue("Jose");
    expect(screen.getByLabelText("First name")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Last name")).toHaveAttribute("readonly");

    await user.click(screen.getByRole("button", { name: "Save contact and location" }));
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      city: "Baliuag",
      barangay: "San Roque",
    })));
    expect(onUpdateProfile.mock.calls[0][0]).not.toHaveProperty("firstName");
    expect(onUpdateProfile.mock.calls[0][0]).not.toHaveProperty("fullName");
  });

  it("validates password confirmation and submits a corrected password", async () => {
    const user = userEvent.setup();
    const onUpdatePassword = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));

    render(<AccountPrivacyPanel sellerProfile={profile} userLocation={location} onUpdatePassword={onUpdatePassword} />);
    await user.click(screen.getByRole("button", { name: /Account & privacy/i }));
    await user.type(screen.getByLabelText("Current password"), "old-password");
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "different-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByRole("alert")).toHaveTextContent("New passwords do not match.");
    expect(onUpdatePassword).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(onUpdatePassword).toHaveBeenCalledWith({
      currentPassword: "old-password",
      newPassword: "new-password",
    }));
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("reads an autofilled current password from the submitted form", async () => {
    const user = userEvent.setup();
    const onUpdatePassword = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));
    render(<AccountPrivacyPanel sellerProfile={profile} onUpdatePassword={onUpdatePassword} />);
    await user.click(screen.getByRole("button", { name: /Account & privacy/i }));
    const current = screen.getByLabelText("Current password");
    if (!(current instanceof HTMLInputElement)) throw new Error("Expected password input");
    current.value = "autofilled-password";
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(onUpdatePassword).toHaveBeenCalledWith({ currentPassword: "autofilled-password", newPassword: "new-password" }));
  });

  it("preserves entered passwords when the update fails", async () => {
    const user = userEvent.setup();
    const onUpdatePassword = vi.fn().mockRejectedValue(new Error("Current password is incorrect."));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));
    render(<AccountPrivacyPanel sellerProfile={profile} onUpdatePassword={onUpdatePassword} />);
    await user.click(screen.getByRole("button", { name: /Account & privacy/i }));
    await user.type(screen.getByLabelText("Current password"), "wrong-password");
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Current password is incorrect."));
    expect(screen.getByLabelText("New password")).toHaveValue("new-password");
  });
});
