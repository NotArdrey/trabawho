import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { complete, getUser, readAttempt, fromTable, selectColumns, browserPath } = vi.hoisted(() => ({
  complete: vi.fn(), getUser: vi.fn(), readAttempt: vi.fn(), fromTable: vi.fn(), selectColumns: vi.fn(), browserPath: vi.fn(),
}));
vi.mock("@sparticuz/chromium", () => ({ default: { executablePath: browserPath, args: ["--no-sandbox"] } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  auth: { getUser },
  from: (table: string) => { fromTable(table); return { select: (columns: string) => {
    selectColumns(columns); return { eq: () => ({ maybeSingle: readAttempt }) };
  } }; },
}) }));
vi.mock("../scripts/paymongo-sandbox-checkout.mts", () => ({ completeSandboxCheckout: complete }));

import handler from "./paymongo-sandbox";

const origin = "https://app.example";
const checkout = { kind: "booking", attemptId: "00000000-0000-0000-0000-000000000001",
  checkoutSessionId: "cs_test123", checkoutUrl: "https://checkout.paymongo.com/test123" };
const attempt = { id: checkout.attemptId, buyer_id: "buyer-1", checkout_session_id: checkout.checkoutSessionId,
  checkout_url: checkout.checkoutUrl, environment: "test", status: "awaiting_payment", expires_at: "2099-01-01T00:00:00Z" };

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/__trabawho_paymongo_sandbox_checkout`, {
    method: "POST", headers: { Origin: origin, Authorization: "Bearer user-token", ...headers },
    body: JSON.stringify(body),
  });
}

describe("deployed test checkout endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("PAYMONGO_SANDBOX_ONE_CLICK_ENABLED", "true");
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_example");
    vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-anon");
    getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } }, error: null });
    readAttempt.mockResolvedValue({ data: attempt, error: null });
    complete.mockResolvedValue(`${origin}/bookings?payment=verifying`);
    browserPath.mockResolvedValue("/tmp/chromium");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("stays disabled unless explicitly enabled with a test secret", async () => {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_live_not_allowed");
    const response = await handler.fetch(new Request(`${origin}/__trabawho_paymongo_sandbox_ready`));
    expect(response.status).toBe(503);
    expect(complete).not.toHaveBeenCalled();
  });

  it("requires same-origin and an authenticated owner of the exact checkout", async () => {
    expect((await handler.fetch(post(checkout, { Origin: "https://other.example" }))).status).toBe(403);
    readAttempt.mockResolvedValueOnce({ data: { ...attempt, buyer_id: "other-user" }, error: null });
    expect((await handler.fetch(post(checkout))).status).toBe(403);
    expect(complete).not.toHaveBeenCalled();
  });

  it("finishes an owned test checkout without accepting a foreign return", async () => {
    const success = await handler.fetch(post(checkout));
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ returnUrl: `${origin}/bookings?payment=verifying` });
    expect(complete).toHaveBeenCalledWith(checkout.checkoutUrl, "sk_test_example", checkout.checkoutSessionId, {});
    complete.mockResolvedValueOnce("https://other.example/bookings?payment=verifying");
    expect((await handler.fetch(post(checkout))).status).toBe(502);
  });

  it("checks boost ownership and uses serverless Chromium on the deployed runtime", async () => {
    vi.stubEnv("VERCEL", "1");
    const boost = { ...checkout, kind: "boost" };
    readAttempt.mockResolvedValueOnce({ data: { ...attempt, seller_id: "buyer-1" }, error: null });
    complete.mockResolvedValueOnce(`${origin}/profile?boostPayment=verifying`);
    expect((await handler.fetch(post(boost))).status).toBe(200);
    expect(fromTable).toHaveBeenCalledWith("service_ad_boost_attempts");
    expect(selectColumns).toHaveBeenCalledWith(expect.stringContaining("seller_id"));
    expect(complete).toHaveBeenCalledWith(boost.checkoutUrl, "sk_test_example", boost.checkoutSessionId,
      { executablePath: "/tmp/chromium", args: ["--no-sandbox"] });
  });
});
