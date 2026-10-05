import { supabase } from "@/integrations/supabase";
import { signOutUser } from '@/shared/services/authSessionService';

export async function completePasswordRecovery(newPassword: string): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error("This password-reset link is invalid or has expired. Request a new link and try again.");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    throw new Error("Your password could not be updated. Request a new reset link and try again.");
  }

  try { await signOutUser(); }
  catch {
    throw new Error("Your password was updated, but this recovery session could not be closed. Close this browser tab before signing in.");
  }
}
