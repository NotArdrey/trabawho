import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as legacyClient } from "@/shared/services/supabaseClient";
import type { Database } from "@/integrations/supabase/database.types";

export { isSupabaseConfigured } from "@/shared/services/supabaseClient";

export const supabase = legacyClient as SupabaseClient<Database>;
