import { supabase } from "@/integrations/supabase";
import { ActionError, databaseActionError } from "@/shared/utils/actionError";

export async function persistBookingReview(bookingId: string, rating: number, comment: string, image: File | null) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ActionError("Choose a rating between 1 and 5.");
  if (comment.trim().length > 1000) throw new ActionError("Keep your review within 1,000 characters.");
  if (image && !["image/jpeg", "image/png", "image/webp"].includes(image.type)) throw new ActionError("Choose a JPG, PNG, or WebP photo.");
  if (image && image.size > 5 * 1024 * 1024) throw new ActionError("Choose a photo no larger than 5 MB.");
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) throw new ActionError("Sign in again before leaving a review.");
  const userId = auth.data.user.id;
  // Read authoritative participants: cached UI records can belong to an older scope or session.
  const booking = await supabase.from("bookings").select("id, buyer_id, seller_id, status").eq("id", bookingId).single();
  if (booking.error || !booking.data) throw new ActionError("This booking could not be loaded. Refresh your bookings and retry.");
  if (booking.data.buyer_id !== userId) throw new ActionError("Only the client who booked this service can leave its review.");
  if (booking.data.status !== "completed") throw new ActionError("Confirm service completion before leaving a review.");
  const existing = await supabase.from("reviews").select("id, image_url").eq("booking_id", bookingId).eq("reviewer_id", userId).maybeSingle();
  if (existing.error) throw databaseActionError(existing.error, "Your review could not be loaded. Retry before submitting.");
  let imageUrl = existing.data?.image_url || "";
  let uploadedPath: string | null = null;
  if (image) {
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    uploadedPath = `${userId}/${bookingId}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("review-images").upload(uploadedPath, image, { contentType: image.type, upsert: false });
    if (upload.error) throw new ActionError("Your photo could not be uploaded. Check your connection and retry.");
    imageUrl = supabase.storage.from("review-images").getPublicUrl(uploadedPath).data.publicUrl;
  }
  const payload = { booking_id: bookingId, seller_id: booking.data.seller_id, reviewer_id: userId, rating, body: comment.trim() || null,
    image_url: imageUrl || null, published: true, updated_at: new Date().toISOString() };
  const saved = existing.data
    ? await supabase.from("reviews").update(payload).eq("id", existing.data.id).eq("reviewer_id", userId).select("id").single()
    : await supabase.from("reviews").insert({ ...payload, title: null }).select("id").single();
  if (saved.error || !saved.data) {
    if (uploadedPath) await supabase.storage.from("review-images").remove([uploadedPath]);
    throw databaseActionError(saved.error || {}, "Your review could not be saved. Your draft is still here; retry.");
  }
  return { rating, review: comment.trim(), reviewImageUrl: imageUrl, canRate: false };
}
