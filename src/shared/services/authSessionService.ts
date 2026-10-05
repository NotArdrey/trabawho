import { supabase } from '@/integrations/supabase';
import { clearPendingAccount } from '@/shared/services/pendingAccountRecovery';

export async function signOutUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  clearPendingAccount();
}
