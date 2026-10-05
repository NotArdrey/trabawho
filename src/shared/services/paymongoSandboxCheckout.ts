/** Runs the local, test-key-only PayMongo checkout helper. Never ship this path as a live payment shortcut. */
export async function ensureLocalSandboxReady() {
  if (!import.meta.env.DEV) throw new Error("One-click test payment is available only in local development.");
  const response = await fetch("/__trabawho_paymongo_sandbox_ready", { cache: "no-store" });
  if (response.ok) return;
  const payload: unknown = await response.json().catch(() => ({}));
  const result = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  throw new Error(typeof result.error === "string" ? result.error : "One-click test payment is not configured. Use hosted test checkout instead.");
}

export async function completeLocalSandboxCheckout(checkoutUrl: string, checkoutSessionId?: string) {
  if (!import.meta.env.DEV) throw new Error("One-click test payment is available only in local development.");
  const response = await fetch("/__trabawho_paymongo_sandbox_checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkoutUrl, checkoutSessionId }),
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
