import { asRecord, cleanPaymentString, createPaymentAdminClient, createPaymentUserClient,
  paymentCorsHeaders, paymentJsonResponse } from "../_shared/paymongo.ts";

export async function handleBookingRefundRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: paymentCorsHeaders });
  if (request.method !== "POST") return paymentJsonResponse({ error: "Method not allowed" }, 405);
  try {
    const body = asRecord(await request.json());
    const caseId = cleanPaymentString(body.caseId);
    const action = cleanPaymentString(body.action);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId)
      || !["approve", "check"].includes(action)) return paymentJsonResponse({ error: "Choose a valid case action." }, 400);
    const user = createPaymentUserClient(request);
    const { data: identity, error: identityError } = await user.auth.getUser();
    if (identityError || !identity.user) return paymentJsonResponse({ error: "Sign in to review refunds." }, 401);
    // The user-scoped query enforces case participation/admin access through RLS.
    const { data: caseRecord, error: caseError } = await user.from("booking_support_cases")
      .select("id, booking_id, case_type").eq("id", caseId).maybeSingle();
    if (caseError || !caseRecord) return paymentJsonResponse({ error: "Case not available to your account." }, 404);
    const { data: isAdmin } = await user.rpc("is_current_user_admin");
    if (action === "approve" && isAdmin !== true) return paymentJsonResponse({ error: "Administrator access required." }, 403);
    if (action === "approve") {
      const reason = cleanPaymentString(body.reason);
      if (reason.length < 20) return paymentJsonResponse({ error: "Explain the refund approval in at least 20 characters." }, 400);
      const expectedAmount = body.expectedAmount;
      if (typeof expectedAmount !== "number" || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        return paymentJsonResponse({ error: "Review the current refund amount before approving." }, 400);
      }
      const { error } = await user.rpc(caseRecord.case_type === "provider_no_show"
        ? "approve_no_show_case_refund" : "approve_booking_case_refund",
      { p_case_id: caseId, p_reason: reason, p_expected_amount: expectedAmount });
      if (error) return paymentJsonResponse({ error: "This case cannot be refunded. Refresh it and verify its payments." }, 409);
    }
    const admin = createPaymentAdminClient();
    const { data: refunds, error: loadError } = await admin.from("booking_refunds")
      .select("id, payment_attempt_id, provider_refund_id, submitted_at, status, amount, currency")
      .eq("booking_id", caseRecord.booking_id).eq("case_id", caseId);
    if (loadError) return paymentJsonResponse({ error: "Refund records could not be loaded." }, 503);
    let needsRetry = false;
    let providerRejected = false;
    let simulatedCount = 0;
    for (const refund of refunds || []) {
      if (["succeeded", "simulated", "failed", "needs_review"].includes(refund.status)) continue;
      // Participants can check existing provider refunds, but cannot submit approvals.
      if (!refund.provider_refund_id && isAdmin !== true) continue;
      if (!refund.provider_refund_id) {
        if (refund.status !== "approved" || refund.submitted_at) {
          needsRetry = true; providerRejected = true;
          continue;
        }
        const { error: simulationError } = await admin.rpc("simulate_booking_case_refund", { p_refund_id: refund.id });
        if (simulationError) needsRetry = true;
        else simulatedCount += 1;
        continue;
      }
      const { data: claimed, error: claimError } = await admin.rpc("claim_booking_refund", { p_refund_id: refund.id });
      if (claimError) { needsRetry = true; continue; }
      if (!claimed?.id) continue;
      const { data: attempt, error: attemptError } = await admin.from("payment_attempts")
        .select("payment_id, environment").eq("id", refund.payment_attempt_id).single();
      if (attemptError || attempt?.environment !== "test" || !attempt.payment_id) { needsRetry = true; continue; }
      const secret = cleanPaymentString(Deno.env.get("PAYMONGO_SECRET_KEY"));
      if (!secret.startsWith("sk_test_")) { needsRetry = true; continue; }
      try {
        const providerId = cleanPaymentString(claimed.provider_refund_id);
        if (!providerId) { needsRetry = true; continue; }
        const response = await fetch(`https://api.paymongo.com/v1/refunds/${encodeURIComponent(providerId)}`, {
          method: "GET",
          signal: AbortSignal.timeout(15_000),
          headers: { Authorization: `Basic ${btoa(`${secret}:`)}`, Accept: "application/json" },
        });
        if (!response.ok) {
          needsRetry = true;
          if (response.status >= 400 && response.status < 500) providerRejected = true;
          continue;
        }
        const resource = asRecord(asRecord(await response.json()).data);
        const attributes = asRecord(resource.attributes);
        // Do not coerce an absent mode or amount into a verification success.
        if (typeof attributes.livemode !== "boolean" || !Number.isInteger(attributes.amount)
          || resource.id !== providerId) { needsRetry = true; continue; }
        const { error: recordError } = await admin.rpc("record_booking_refund", {
          p_refund_id: refund.id, p_provider_refund_id: cleanPaymentString(resource.id),
          p_payment_id: cleanPaymentString(attributes.payment_id), p_amount: Number(attributes.amount) / 100,
          p_currency: cleanPaymentString(attributes.currency), p_livemode: attributes.livemode,
          p_status: cleanPaymentString(attributes.status),
        });
        if (recordError) needsRetry = true;
      } catch { needsRetry = true; }
    }
    return paymentJsonResponse({ checked: true, needsRetry, providerRejected, simulatedCount });
  } catch {
    return paymentJsonResponse({ error: "Refund processing could not finish. Check the saved status before retrying." }, 503);
  }
}
