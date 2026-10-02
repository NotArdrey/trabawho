import { supabase } from "@/integrations/supabase/client";
import { ActionError, databaseActionError } from "@/shared/utils/actionError";
import type { ServiceProfileUpdate } from "../components/ProfileEditModal";
import { buildServiceUpdate } from "../utils/serviceDraft";

export async function saveServiceEdit(serviceId: number, sellerId: string, profile: ServiceProfileUpdate) {
  // Read current metadata so availability, boosting and unrelated settings survive an edit.
  const current = await supabase.from("services").select("*").eq("id", serviceId).eq("seller_id", sellerId).single();
  if (current.error) throw databaseActionError(current.error, "Unable to load the selected service. Refresh and retry.");
  if (!current.data) throw new ActionError("This service is no longer available. Refresh and retry.");
  const payload = buildServiceUpdate(profile, current.data.metadata);
  const result = await supabase.from("services").update(payload).eq("id", serviceId).eq("seller_id", sellerId).select("*").single();
  if (result.error) throw databaseActionError(result.error, "Unable to save the selected service. Your edits are still here; try again.");
  if (!result.data) throw new ActionError("This service could not be saved. Refresh and retry.");
  const payment = await supabase.from("worker_profiles").update({
    payment_advance: profile.paymentAdvance ?? false,
    payment_after_service: profile.paymentAfterService ?? true,
    after_service_payment_type: profile.afterServicePaymentType || "both",
    gcash_number: profile.gcashNumber?.trim() || null,
  }).eq("user_id", sellerId).select("user_id").single();
  if (payment.error || !payment.data) throw new ActionError("Your listing was saved, but payment preferences could not be saved. Your edits are still here; try again.");
  return result.data;
}
