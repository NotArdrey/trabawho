import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({ supabase: { auth } }));

import { changePassword } from "./changePassword";

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getUser.mockResolvedValue({ data: { user: { id: "account-1" } }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
  });

  it("verifies the old password in the update request without replacing the session", async () => {
    await changePassword({ currentPassword: "old-password", newPassword: "new-password" });
    expect(auth.updateUser).toHaveBeenCalledWith({ current_password: "old-password", password: "new-password" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects expired sessions before attempting an update", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(changePassword({ currentPassword: "old-password", newPassword: "new-password" })).rejects.toThrow(/session has expired/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("distinguishes a connection failure from an expired session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Failed to fetch") });
    await expect(changePassword({ currentPassword: "old-password", newPassword: "new-password" })).rejects.toThrow(/Check your connection/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("shows corrective feedback for an incorrect current password", async () => {
    auth.updateUser.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid credentials" } });
    await expect(changePassword({ currentPassword: "wrong-password", newPassword: "new-password" })).rejects.toThrow("Current password is incorrect.");
  });
});
