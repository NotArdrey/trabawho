import { corsHeaders, createAdminClient, isUuid, jsonResponse } from "../_shared/identityRegistration.ts";
import { asRecord } from "../_shared/identityDomain.ts";
import { identityIntegrationStatus } from "../_shared/identityIntegrationStatus.ts";
import { deliverIdentityConfirmation, loadIdentityReviewDetail, requireIdentityAdmin, reviewColumns, ReviewError } from "../_shared/identityReview.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const client = createAdminClient();
    const adminId = await requireIdentityAdmin(req, client);
    const body = asRecord(await req.json());
    if (body.action === "integration_status") return jsonResponse({ success: true, ...await identityIntegrationStatus() });
    if (body.action === "list") {
      const page = typeof body.page === "number" && Number.isInteger(body.page) ? Math.max(1, Math.min(1000, body.page)) : 1;
      const pageSize = 20;
      const status = typeof body.status === "string" ? body.status : "PENDING_REVIEW";
      if (!["all", "PENDING_REVIEW", "APPROVED", "DECLINED"].includes(status)) throw new ReviewError("Choose a review status.", 400);
      let query = client.from("manual_identity_reviews").select(reviewColumns, { count: "exact" });
      if (status !== "all") query = query.eq("status", status);
      const search = typeof body.search === "string" ? body.search.trim().slice(0, 150) : "";
      if (search) query = query.ilike("submitted_by_email", `%${search.replace(/[%_]/g, "\\$&")}%`);
      const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new ReviewError("Identity reviews could not be loaded. Retry.", 503);
      return jsonResponse({ success: true, items: data, total: count, page, pageSize });
    }
    if (!isUuid(body.reviewId)) throw new ReviewError("Choose an identity review.", 400);
    const reviewId = String(body.reviewId);
    if (body.action === "detail") return jsonResponse({ success: true, ...await loadIdentityReviewDetail(client, reviewId) });
    if (body.action === "retry_email") return jsonResponse({ success: true, emailDelivery: await deliverIdentityConfirmation(client, reviewId, true) });
    if (body.action !== "decide") throw new ReviewError("Choose a supported review action.", 400);
    if (!["APPROVED", "DECLINED"].includes(String(body.decision)) || !isUuid(body.operationId))
      throw new ReviewError("Choose approval or rejection and try again.", 400);
    if (body.decision === "APPROVED" && body.evidenceReviewed !== true)
      throw new ReviewError("Review the identity evidence before approving.", 400);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 20 || reason.length > 2000) throw new ReviewError("Explain the decision in 20 to 2000 characters.", 400);
    const { data, error } = await client.rpc("decide_account_identity_review", {
      p_review_id: reviewId, p_actor_id: adminId, p_decision: body.decision,
      p_reason: reason, p_operation_id: body.operationId,
      p_reviewed_name: typeof body.reviewedLegalName === 'string' ? body.reviewedLegalName.trim() : null,
    });
    if (error) {
      if (error.code === "42501") throw new ReviewError("Administrator access is required.", 403);
      if (["23514", "23505"].includes(error.code)) throw new ReviewError("This review or account has changed. Refresh before deciding.", 409);
      throw new ReviewError("The decision could not be saved. Retry.", 503);
    }
    const emailDelivery = body.decision === "APPROVED" ? await deliverIdentityConfirmation(client, reviewId) : null;
    return jsonResponse({ success: true, ...asRecord(data), emailDelivery });
  } catch (error) {
    if (error instanceof ReviewError) return jsonResponse({ success: false, error: error.message }, error.status);
    console.error("admin_identity_review_failed");
    return jsonResponse({ success: false, error: "The identity review request failed. Try again." }, 500);
  }
});
