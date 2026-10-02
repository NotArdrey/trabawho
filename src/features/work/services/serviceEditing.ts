import { supabase } from "@/integrations/supabase/client";
import type { ServiceProfileUpdate } from "../components/ProfileEditModal";
import { buildServiceUpdate } from "../utils/serviceDraft";

export async function saveServiceEdit(serviceId: number, sellerId: string, profile: ServiceProfileUpdate) {
  // Read current metadata so availability, boosting and unrelated settings survive an edit.
  const current = await supabase.from("services").select("*").eq("id", serviceId).eq("seller_id", sellerId).single();
  if (current.error || !current.data) throw new Error("Unable to load the selected service.");
  const payload = buildServiceUpdate(profile, current.data.metadata);
  const result = await supabase.from("services").update(payload).eq("id", serviceId).eq("seller_id", sellerId).select("*").single();
  if (result.error || !result.data) throw new Error("Unable to save the selected service.");
  const payment = await supabase.from("sellers").update({
    payment_advance: profile.paymentAdvance ?? false,
    payment_after_service: profile.paymentAfterService ?? true,
    after_service_payment_type: profile.afterServicePaymentType || "both",
    gcash_number: profile.gcashNumber?.trim() || null,
  }).eq("user_id", sellerId);
  if (payment.error) throw new Error("Service saved, but payment preferences could not be saved. Try again.");
  return result.data;
}
