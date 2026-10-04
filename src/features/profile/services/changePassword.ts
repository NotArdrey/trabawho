import { supabase } from "@/integrations/supabase";

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword({ currentPassword, newPassword }: ChangePasswordInput): Promise<void> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw new Error("Could not verify your session. Check your connection and try again.");
  }
  if (!data.user) {
    throw new Error("Your session has expired. Sign in again before changing your password.");
  }

  // Supabase checks the old password in the same authenticated update request.
  // Signing in again here would replace the current browser session.
  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password: newPassword,
  });
  if (!error) return;
  if (/current.password|invalid.credentials/i.test(`${error.code || ""} ${error.message}`)) {
    throw new Error("Current password is incorrect.");
  }
  if (/weak.password|password.*short|password.*strength/i.test(`${error.code || ""} ${error.message}`)) {
    throw new Error("Choose a stronger new password and try again.");
  }
  throw new Error("Password could not be updated. Try again or use Forgot password from sign-in.");
}
