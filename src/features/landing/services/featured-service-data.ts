import { supabase } from "@/integrations/supabase/client";

/** Load public landing facts without depending on marketplace warranty hydration. */
export async function fetchLandingServiceRows() {
  const { data, error } = await supabase
    .from("services")
    .select("id, seller_id, title, base_price, price_type, duration_minutes, metadata, sellers(user_id, display_name, profile_photo, avatar_url, is_verified, search_meta)")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(4);

  if (error) throw new Error("Service listings could not be loaded.");
  const rows = data ?? [];
  const sellerIds = [...new Set(rows.map((row) => row.seller_id).filter((id): id is string => Boolean(id)))];
  if (!sellerIds.length) return rows;

  // Ratings enrich listings; a denied or unavailable aggregate must not hide services.
  const { data: ratings, error: ratingError } = await supabase
    .from("seller_rating_aggregates")
    .select("seller_id, avg_rating, rating_count")
    .in("seller_id", sellerIds);
  const bySeller = new Map((ratingError ? [] : ratings ?? []).map((rating) => [rating.seller_id, rating]));

  return rows.map((row) => {
    const rating = row.seller_id ? bySeller.get(row.seller_id) : undefined;
    return { ...row, rating: rating?.avg_rating ?? null, reviews_count: rating?.rating_count ?? 0 };
  });
}
