import { handleBookingRefundRequest } from "./handler.ts";
import { asRecord } from "../_shared/paymongo.ts";

const caseId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function run(input: { admin?: boolean; providerId?: string; action?: string; locked?: boolean; providerFailure?: boolean; providerRejected?: boolean; invalidMode?: boolean }) {
  Deno.env.set("SUPABASE_URL", "https://refund-fixture.test");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
  Deno.env.set("PAYMONGO_SECRET_KEY", "sk_test_fixture");
  const originalFetch = globalThis.fetch;
  const providerRequests: { method: string; key: string | null; body: Record<string, unknown> }[] = [];
  const recorded: Record<string, unknown>[] = [];
  const simulated: Record<string, unknown>[] = [];
  let approvals = 0;
  let loadedCaseId: string | null = null;
  globalThis.fetch = async (url, options) => {
    const request = new Request(url, options);
    const path = new URL(request.url).pathname;
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
    if (path === "/auth/v1/user") return json({ id: "11111111-1111-1111-1111-111111111111" });
    if (path === "/rest/v1/booking_support_cases") return json({ id: caseId, booking_id: "booking-1" });
    if (path === "/rest/v1/rpc/is_current_user_admin") return json(input.admin === true);
    if (path === "/rest/v1/rpc/approve_booking_case_refund") { approvals++; return json({ bookingId: "booking-1" }); }
    if (path === "/rest/v1/booking_refunds") {
      loadedCaseId = new URL(request.url).searchParams.get("case_id");
      return json([{ id: "refund-1", payment_attempt_id: "attempt-1", amount: 464, currency: "PHP", status: "approved", submitted_at: null, provider_refund_id: input.providerId || null }]);
    }
    if (path === "/rest/v1/rpc/simulate_booking_case_refund") { simulated.push(asRecord(await request.json())); return json({ id: "refund-1", status: "simulated" }); }
    if (path === "/rest/v1/rpc/claim_booking_refund") return json(input.locked ? null : { id: "refund-1", provider_refund_id: input.providerId || null });
    if (path === "/rest/v1/payment_attempts") return json({ payment_id: "pay_deposit", environment: "test" });
    if (path === "/rest/v1/rpc/record_booking_refund") { recorded.push(asRecord(await request.json())); return json(null); }
    if (new URL(request.url).hostname === "api.paymongo.com") {
      providerRequests.push({ method: request.method, key: request.headers.get("Idempotency-Key"), body: request.method === "POST" ? asRecord(await request.json()) : {} });
      if (input.providerFailure) return json({ error: "Unavailable" }, 503);
      if (input.providerRejected) return json({ error: "Not refundable" }, 422);
      return json({ data: { id: "ref_provider", attributes: {
        payment_id: "pay_deposit", amount: 46400, currency: "PHP", status: "pending", livemode: input.invalidMode ? null : false,
      } } });
    }
    throw new Error(`Unexpected fixture endpoint: ${path}`);
  };
  try {
    const response = await handleBookingRefundRequest(new Request("https://refund-fixture.test/handler", {
      method: "POST", headers: { Authorization: "Bearer test-user", "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, action: input.action || "check", reason: "Reviewed the evidence and approved the customer refund.", expectedAmount: 464, amount: 999999 }),
    }));
    return { status: response.status, body: asRecord(await response.json()), providerRequests, recorded, simulated, approvals, loadedCaseId };
  } finally { globalThis.fetch = originalFetch; }
}

Deno.test("client cannot approve or submit an unapproved refund", async () => {
  const denied = await run({ action: "approve" });
  assert(denied.status === 403 && denied.approvals === 0 && denied.providerRequests.length === 0, "Client approved money movement");
  const check = await run({});
  assert(check.providerRequests.length === 0, "Client submitted a provider refund");
});
Deno.test("admin completes the reviewed test refund without calling PayMongo", async () => {
  const result = await run({ admin: true, action: "approve" });
  assert(result.status === 200 && result.approvals === 1, "Approval failed");
  assert(result.loadedCaseId === `eq.${caseId}`, "Refund processing escaped the owning case");
  assert(result.providerRequests.length === 0, "Sandbox simulation called PayMongo");
  assert(result.simulated.length === 1 && result.simulated[0].p_refund_id === "refund-1", "Reviewed refund not simulated");
});
Deno.test("participant reconciliation retrieves an existing refund without issuing again", async () => {
  const result = await run({ providerId: "ref_provider" });
  assert(result.providerRequests.length === 1 && result.providerRequests[0].method === "GET", "Reconciliation submitted another refund");
  assert(result.recorded.length === 1, "Reconciliation not recorded");
});
Deno.test("concurrent claims cannot submit twice", async () => {
  const result = await run({ admin: true, locked: true, providerId: "ref_provider" });
  assert(result.providerRequests.length === 0 && result.recorded.length === 0, "Lease ignored");
});
Deno.test("provider failures and absent environment do not fabricate success", async () => {
  for (const input of [{ providerFailure: true }, { invalidMode: true }]) {
    const result = await run({ admin: true, providerId: "ref_provider", ...input });
    assert(result.body.needsRetry === true && result.recorded.length === 0, "Unverified refund recorded");
  }
});
Deno.test("a provider rejection is reported without claiming a refund succeeded", async () => {
  const result = await run({ admin: true, action: "approve", providerId: "ref_provider", providerRejected: true });
  assert(result.body.providerRejected === true && result.body.needsRetry === true,
    "Provider rejection was not disclosed");
  assert(result.recorded.length === 0, "Rejected refund was marked as paid");
});
