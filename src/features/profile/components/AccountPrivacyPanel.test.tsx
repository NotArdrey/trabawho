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
  it("keeps private settings collapsed until requested and saves existing personal information", async () => {
    const user = userEvent.setup();
    const onUpdateProfile = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));

    render(<AccountPrivacyPanel sellerProfile={profile} userLocation={location} onUpdateProfile={onUpdateProfile} />);

    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Account & privacy/i }));
    expect(screen.getByLabelText("First name")).toHaveValue("Jose");

    await user.click(screen.getByRole("button", { name: "Save personal information" }));
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      firstName: "Jose",
      lastName: "Ramos",
      city: "Baliuag",
      barangay: "San Roque",
    })));
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
  });
});
