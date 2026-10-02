import { supabase } from "@/integrations/supabase";
import type { Database } from "@/integrations/supabase/database.types";
import { getProfilePhotoUrl } from "@/shared/utils/profilePhoto";

type Service = Database["public"]["Tables"]["services"]["Row"];
/** Load in pages so an older paid gig cannot disappear behind a newest-only cap. */
export async function fetchMarketplaceServices() {
  const services: Service[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("services").select("*").eq("active", true)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
    if (error) throw new Error("Unable to load services. Please retry.");
    services.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const sellerIds = [...new Set(services.map((row) => row.seller_id))];
  if (!sellerIds.length) return [];
  // Keep requests below URL-size limits as the marketplace grows.
  const sellers = new Map<string, Database["public"]["Tables"]["sellers"]["Row"]>();
  const ratings = new Map<string, Database["public"]["Tables"]["seller_rating_aggregates"]["Row"]>();
  const policies = new Map<number, Database["public"]["Tables"]["service_warranty_policies"]["Row"]>();
  for (let offset = 0; offset < sellerIds.length; offset += 100) {
    const ids = sellerIds.slice(offset, offset + 100);
    const results = await Promise.all([
      supabase.from("sellers").select("*").in("user_id", ids),
      supabase.from("seller_rating_aggregates").select("*").in("seller_id", ids),
    ]);
    if (results.some((result) => result.error)) throw new Error("Unable to load provider details. Please retry.");
    for (const row of results[0].data || []) sellers.set(row.user_id, row);
    for (const row of results[1].data || []) ratings.set(row.seller_id, row);
  }
  for (let offset = 0; offset < services.length; offset += 100) {
    const { data, error } = await supabase.from("service_warranty_policies").select("*").in("service_id", services.slice(offset, offset + 100).map((row) => row.id));
    if (error) throw new Error("Unable to load service policies. Please retry.");
    for (const row of data || []) policies.set(row.service_id, row);
  }
  return services.map((service) => {
    const seller = sellers.get(service.seller_id);
    const rating = ratings.get(service.seller_id);
    const photo = getProfilePhotoUrl(seller?.profile_photo || seller?.avatar_url || "");
    return { ...service, rating: rating?.avg_rating ?? null,
      reviews_count: rating?.rating_count ?? 0,
      sellers: seller ? { ...seller, avg_rating: rating?.avg_rating ?? null,
        rating_count: rating?.rating_count ?? 0, profile_photo: photo, avatar_url: photo } : null,
      service_warranty_policies: policies.has(service.id) ? [policies.get(service.id)] : [] };
  });
}
