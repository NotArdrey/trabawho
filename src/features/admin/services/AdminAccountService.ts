import { fetchAdminAccounts, updateAdminAccountRole, updateAdminAccountStatus } from "@/shared/services/authService";
import { supabase } from "@/integrations/supabase";
import type { Database } from "@/integrations/supabase";
import type { AdminAccount, AdminComment, AccountStatus, ReviewPage, ReviewQuery } from "../types";

type Review = Database["public"]["Tables"]["reviews"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Seller = Database["public"]["Tables"]["sellers"]["Row"];

function formatReviewComment(review: Review, profiles: Record<string, Profile>, sellers: Record<string, Seller>): AdminComment {
  const reviewer = profiles[review.reviewer_id];
  const seller = sellers[review.seller_id];
  return {
    id: review.id,
    worker: seller?.display_name || "Service Provider",
    client: reviewer?.full_name || reviewer?.email || "Client",
    rating: review.rating,
    comment: review.body || review.title || "",
    status: review.published === false ? "review" : "published",
    createdAt: review.created_at,
  };
}

export const AdminAccountService = {
  async fetchAccounts(): Promise<AdminAccount[]> {
    const rows = await fetchAdminAccounts();
    return rows as AdminAccount[];
  },

  async updateRole(userId: string, role: "client" | "admin"): Promise<void> {
    if (!userId) throw new Error("User ID is required");
    await updateAdminAccountRole({ userId, role });
  },

  async updateStatus(userId: string, status: AccountStatus, reason = "", durationMinutes: number | null = null): Promise<void> {
    if (!userId) throw new Error("User ID is required");
    const updateStatus = updateAdminAccountStatus as (input: { userId: string; status: AccountStatus; reason: string; durationMinutes: number | null }) => Promise<unknown>;
    await updateStatus({ userId, status, reason, durationMinutes });
  },

  async fetchComments({ page, pageSize, search, status, rating }: ReviewQuery): Promise<ReviewPage> {
    let request = supabase.from("reviews").select("*", { count: "exact" });
    if (search.trim()) request = request.ilike("body", `%${search.trim()}%`);
    if (status === "unpublished") request = request.eq("published", false);
    if (status === "published") request = request.or("published.eq.true,published.is.null");
    if (rating !== "all") request = request.eq("rating", Number(rating));
    const { data: reviews, count, error } = await request.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    if (!reviews?.length) return { items: [], total: count ?? 0 };

    const reviewerIds = [...new Set(reviews.map((review) => review.reviewer_id).filter(Boolean))];
    const sellerIds = [...new Set(reviews.map((review) => review.seller_id).filter(Boolean))];
    const [profilesResult, sellersResult] = await Promise.all([
      reviewerIds.length ? supabase.from("profiles").select("*").in("user_id", reviewerIds) : Promise.resolve({ data: [] as Profile[], error: null }),
      sellerIds.length ? supabase.from("sellers").select("*").in("user_id", sellerIds) : Promise.resolve({ data: [] as Seller[], error: null }),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (sellersResult.error) throw sellersResult.error;
    const profiles = Object.fromEntries((profilesResult.data || []).map((profile) => [profile.user_id, profile]));
    const sellers = Object.fromEntries((sellersResult.data || []).map((seller) => [seller.user_id, seller]));
    return { items: reviews.map((review) => formatReviewComment(review, profiles, sellers)), total: count ?? 0 };
  },

  async deleteComment(commentId: number | string): Promise<void> {
    if (!commentId) throw new Error("Comment ID is required");
    const { error } = await supabase.from("reviews").delete().eq("id", Number(commentId));
    if (error) throw error;
  },

  calculateDurationMinutes(value: string, unit: "minutes" | "hours" | "days"): number {
    const multiplier = { minutes: 1, hours: 60, days: 1440 }[unit];
    return Number(value) * multiplier;
  },
};

export default AdminAccountService;
