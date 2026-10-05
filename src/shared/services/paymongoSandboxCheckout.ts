import { supabase } from "@/integrations/supabase";
import type { SandboxCheckoutKind } from "@/shared/domain/paymongoSandboxAccess";

/** Uses a test-key-only helper. Deployed access requires a server-side opt-in and attempt ownership. */
export async function ensureLocalSandboxReady() {
  const response = await fetch("/__trabawho_paymongo_sandbox_ready", { cache: "no-store" });
  if (response.ok) return;
  const payload: unknown = await response.json().catch(() => ({}));
  const result = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  throw new Error(typeof result.error === "string" ? result.error : "One-click test payment is not configured. Use hosted test checkout instead.");
}

export async function completeLocalSandboxCheckout(
  checkoutUrl: string, checkoutSessionId?: string, attemptId?: string, kind: SandboxCheckoutKind = "booking",
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!import.meta.env.DEV) {
    if (!attemptId || !checkoutSessionId) throw new Error("Start a new test checkout before using one-click payment.");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sign in again before testing payment.");
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const response = await fetch("/__trabawho_paymongo_sandbox_checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ checkoutUrl, checkoutSessionId, attemptId, kind }),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  const result = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "One-click test payment could not finish. Try the hosted test checkout.");
  if (typeof result.returnUrl !== "string") throw new Error("The test payment did not return to the app. Check payment status before retrying.");
  const returnUrl = new URL(result.returnUrl);
  if (returnUrl.origin !== window.location.origin ||
    !(returnUrl.pathname === "/bookings" && returnUrl.searchParams.get("payment") === "verifying") &&
    !(returnUrl.pathname === "/profile" && returnUrl.searchParams.get("boostPayment") === "verifying")) {
    throw new Error("The test payment returned to an unexpected page. Check payment status before retrying.");
  }
  window.location.assign(returnUrl.toString());
}
