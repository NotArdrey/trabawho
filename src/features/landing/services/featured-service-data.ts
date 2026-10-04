import { supabase } from "@/integrations/supabase/client";

const FEATURED_LIMIT = 4;
const PAGE_SIZE = 100;

/** Select recent services from distinct provider accounts without requiring a new RPC. */
export async function fetchLandingServiceRows() {
  const selected: Array<{
    id: number;
    seller_id: string;
    title: string;
    base_price: number | null;
    price_type: string | null;
    duration_minutes: number | null;
    metadata: unknown;
  }> = [];
  const seenSellers = new Set<string>();

  for (let offset = 0; selected.length < FEATURED_LIMIT; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("services")
      .select("id, seller_id, title, base_price, price_type, duration_minutes, metadata")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Service listings could not be loaded.");

    for (const row of data ?? []) {
      if (!row.seller_id || seenSellers.has(row.seller_id)) continue;
      seenSellers.add(row.seller_id);
      selected.push(row);
      if (selected.length === FEATURED_LIMIT) break;
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  if (!selected.length) return [];
  const sellerIds = selected.map((row) => row.seller_id);
  const [sellerResult, ratingResult] = await Promise.all([
    supabase.from("sellers")
      .select("user_id, display_name, profile_photo, avatar_url, is_verified, search_meta")
      .in("user_id", sellerIds),
    supabase.from("seller_rating_aggregates")
      .select("seller_id, avg_rating, rating_count")
      .in("seller_id", sellerIds),
  ]);
  if (sellerResult.error) throw new Error("Provider details could not be loaded.");

  const sellers = new Map((sellerResult.data ?? []).map((seller) => [seller.user_id, seller]));
  // Ratings enrich listings; a denied aggregate must not hide services.
  const ratings = new Map((ratingResult.error ? [] : ratingResult.data ?? [])
    .map((rating) => [rating.seller_id, rating]));

  return selected.map((row) => {
    const rating = ratings.get(row.seller_id);
    return {
      ...row,
      sellers: sellers.get(row.seller_id) ?? null,
      rating: rating?.avg_rating ?? null,
      reviews_count: rating?.rating_count ?? 0,
    };
  });
}
