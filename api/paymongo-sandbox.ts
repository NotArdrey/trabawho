import { createClient } from "@supabase/supabase-js";
import type chromiumPackage from "@sparticuz/chromium";

import { completeSandboxCheckout, sandboxSessionPaid } from "../scripts/paymongo-sandbox-checkout";
import {
  ownsOpenSandboxCheckout, sandboxCheckoutEnabled, sandboxReturnUrlAllowed,
  type SandboxCheckoutRequest,
} from "../src/shared/domain/paymongoSandboxAccess";

const activeSessions = new Set<string>();
const maxBodyBytes = 2048;

function json(body: Record<string, string>, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function checkoutInput(value: unknown): SandboxCheckoutRequest | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.kind !== "booking" && data.kind !== "boost") return null;
  if (typeof data.attemptId !== "string" || typeof data.checkoutSessionId !== "string" ||
    typeof data.checkoutUrl !== "string") return null;
  return { kind: data.kind, attemptId: data.attemptId, checkoutSessionId: data.checkoutSessionId,
    checkoutUrl: data.checkoutUrl };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const secret = process.env.PAYMONGO_SECRET_KEY;
    if (!sandboxCheckoutEnabled(process.env.PAYMONGO_SANDBOX_ONE_CLICK_ENABLED, secret)) {
      return json({ error: "One-click sandbox checkout is unavailable. Use PayMongo's hosted test checkout." }, 503);
    }
    if (request.method === "GET") return json({ status: "ready" }, 200);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    const appOrigin = new URL(request.url).origin;
    if (request.headers.get("origin") !== appOrigin) return json({ error: "Open checkout from this app." }, 403);
    const bearer = /^Bearer (\S+)$/.exec(request.headers.get("authorization") || "")?.[1];
    if (!bearer) return json({ error: "Sign in again before testing payment." }, 401);

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return json({ error: "Sandbox payment is not configured on this deployment." }, 503);
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser(bearer);
    if (authError || !auth.user) return json({ error: "Sign in again before testing payment." }, 401);

    const raw = await request.text();
    if (raw.length > maxBodyBytes) return json({ error: "The checkout request is too large." }, 413);
    let checkout: SandboxCheckoutRequest | null = null;
    try { checkout = checkoutInput(JSON.parse(raw)); } catch { /* Reject malformed input below. */ }
    if (!checkout || !/^cs_[A-Za-z0-9_-]+$/.test(checkout.checkoutSessionId)) {
      return json({ error: "Start a new test checkout before using one-click payment." }, 400);
    }

    const { data: attempt, error: attemptError } = await (checkout.kind === "booking"
      ? userClient.from("payment_attempts")
        .select("id,buyer_id,booking_id,amount,currency,checkout_session_id,checkout_url,environment,status,expires_at")
        .eq("id", checkout.attemptId).maybeSingle()
      : userClient.from("service_ad_boost_attempts")
        .select("id,seller_id,amount,currency,checkout_session_id,checkout_url,environment,status,expires_at")
        .eq("id", checkout.attemptId).maybeSingle());
    if (attemptError || !ownsOpenSandboxCheckout(attempt, checkout, auth.user.id)) {
      return json({ error: "This test checkout is unavailable. Start a new payment from your account." }, 403);
    }

    if (activeSessions.has(checkout.checkoutSessionId)) {
      return json({ error: "This test checkout is already processing. Check its payment status before retrying." }, 409);
    }
    activeSessions.add(checkout.checkoutSessionId);
    try {
      // Keep the package external so it can resolve its bundled Brotli binaries
      // relative to its own directory in the Vercel function.
      let browserOptions: { executablePath?: string; args?: string[] } = {};
      if (process.env.VERCEL) {
        const packageName = ["@sparticuz", "chromium"].join("/");
        const chromiumBinary = (await import(packageName) as { default: typeof chromiumPackage }).default;
        browserOptions = { executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args };
      }
      const returnUrl = await completeSandboxCheckout(checkout.checkoutUrl, secret!, checkout.checkoutSessionId, browserOptions);
      if (!sandboxReturnUrlAllowed(returnUrl, appOrigin)) {
        return json({ error: "PayMongo returned to a different app URL. Check payment status before retrying." }, 502);
      }
      return json({ returnUrl }, 200);
    } catch (error) {
      console.error("sandbox_checkout_failed", error instanceof Error ? error.name : "unknown");
      // PayMongo can complete the test charge even when its hosted page never
      // navigates back. Check the exact owned session before reporting failure.
      try {
        if (await sandboxSessionPaid({ amount: Number(attempt!.amount), currency: String(attempt!.currency),
          attemptId: checkout.attemptId, checkoutSessionId: checkout.checkoutSessionId,
          checkoutUrl: checkout.checkoutUrl, kind: checkout.kind, secret: secret! })) {
          const url = new URL(checkout.kind === "booking" ? "/bookings" : "/profile", appOrigin);
          url.searchParams.set(checkout.kind === "booking" ? "payment" : "boostPayment", "verifying");
          if (checkout.kind === "booking") {
            url.searchParams.set("booking", String(attempt && "booking_id" in attempt ? attempt.booking_id : ""));
            url.searchParams.set("attempt", checkout.attemptId);
          } else url.searchParams.set("boostAttempt", checkout.attemptId);
          return json({ returnUrl: url.toString() }, 200);
        }
      } catch (checkError) {
        console.error("sandbox_checkout_recheck_failed", checkError instanceof Error ? checkError.name : "unknown");
      }
      return json({ error: "PayMongo did not confirm this test payment. Check payment status before retrying, or use the hosted checkout for this attempt." }, 502);
    } finally { activeSessions.delete(checkout.checkoutSessionId); }
  },
};
