import { supabase } from "@/integrations/supabase";
import { ActionError } from "@/shared/utils/actionError";

export async function requireAdminReadAccess() {
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) throw new ActionError("Sign in again to load admin activity.");
  const profile = await supabase.from("profiles").select("role").eq("user_id", auth.data.user.id).single();
  if (profile.error || profile.data?.role !== "admin") throw new ActionError("An admin account is required to view this activity.");
}
