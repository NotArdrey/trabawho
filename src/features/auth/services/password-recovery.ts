import { supabase } from "@/integrations/supabase";

export async function completePasswordRecovery(newPassword: string): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error("This password-reset link is invalid or has expired. Request a new link and try again.");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    throw new Error("Your password could not be updated. Request a new reset link and try again.");
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    throw new Error("Your password was updated, but this recovery session could not be closed. Close this browser tab before signing in.");
  }
}
