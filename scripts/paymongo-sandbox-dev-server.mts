import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv } from "vite";

import { completeSandboxCheckout } from "./paymongo-sandbox-checkout.ts";

export const sandboxCheckoutEndpoint = "/__trabawho_paymongo_sandbox_checkout";
export const sandboxReadyEndpoint = "/__trabawho_paymongo_sandbox_ready";
const maxBodyBytes = 2048;
let checkoutRunning = false;

function respond(response: ServerResponse, status: number, body: Record<string, string>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function loopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address || "")) return false;
  try { return ["127.0.0.1", "localhost"].includes(new URL(`http://${request.headers.host}`).hostname); }
  catch { return false; }
}

function localOrigin(request: IncomingMessage): URL | null {
  if (!loopbackRequest(request)) return null;
  try {
    const origin = new URL(String(request.headers.origin));
    if (origin.protocol !== "http:" || origin.host !== request.headers.host ||
      !["127.0.0.1", "localhost"].includes(origin.hostname)) return null;
    return origin;
  } catch { return null; }
}

async function readCheckout(request: IncomingMessage): Promise<{ checkoutUrl: string; checkoutSessionId?: string }> {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > maxBodyBytes) throw new Error("Request too large.");
  }
  const input: unknown = JSON.parse(body);
  if (!input || typeof input !== "object" || !("checkoutUrl" in input) ||
    typeof input.checkoutUrl !== "string") throw new Error("A checkout URL is required.");
  const checkoutSessionId = "checkoutSessionId" in input && typeof input.checkoutSessionId === "string"
    ? input.checkoutSessionId : undefined;
  return { checkoutUrl: input.checkoutUrl, checkoutSessionId };
}

export async function paymongoSandboxMiddleware(
  request: IncomingMessage, response: ServerResponse, next: () => void,
): Promise<void> {
  if (request.url === sandboxReadyEndpoint) {
    if (request.method !== "GET" || !loopbackRequest(request)) {
      respond(response, 403, { error: "Local sandbox checkout is available only from this development app." });
      return;
    }
    const env = loadEnv("development", process.cwd(), "");
    const secret = process.env.PAYMONGO_SECRET_KEY || env.PAYMONGO_SECRET_KEY || "";
    respond(response, secret.startsWith("sk_test_") ? 200 : 503, secret.startsWith("sk_test_")
      ? { status: "ready" }
      : { error: "Add PAYMONGO_SECRET_KEY=sk_test_... to the ignored .env.local, then restart the dev server." });
    return;
  }
  if (request.url !== sandboxCheckoutEndpoint) { next(); return; }
  if (request.method !== "POST" || !localOrigin(request)) {
    respond(response, 403, { error: "Local sandbox checkout is available only from this development app." });
    return;
  }
  if (checkoutRunning) { respond(response, 429, { error: "A sandbox test payment is already running." }); return; }
  const env = loadEnv("development", process.cwd(), "");
  const secret = process.env.PAYMONGO_SECRET_KEY || env.PAYMONGO_SECRET_KEY || "";
  if (!secret.startsWith("sk_test_")) {
    respond(response, 503, { error: "Add PAYMONGO_SECRET_KEY=sk_test_... to the ignored .env.local, then restart the dev server." });
    return;
  }
  checkoutRunning = true;
  try {
    const { checkoutUrl, checkoutSessionId } = await readCheckout(request);
    const returnUrl = new URL(await completeSandboxCheckout(checkoutUrl, secret, checkoutSessionId));
    const origin = localOrigin(request);
    if (!origin || returnUrl.origin !== origin.origin ||
      !(returnUrl.pathname === "/bookings" && returnUrl.searchParams.get("payment") === "verifying") &&
      !(returnUrl.pathname === "/profile" && returnUrl.searchParams.get("boostPayment") === "verifying")) {
      respond(response, 502, { error: "PayMongo returned to a different app URL. Check the configured app origin." });
      return;
    }
    respond(response, 200, { returnUrl: returnUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sandbox checkout did not complete.";
    const safeMessage = /PayMongo card form changed|submit button|checkout URL|checkout link|checkout session|test secret|not confirmed as PayMongo test mode|payment server did not provide/i.test(message)
      ? message : "Sandbox checkout did not finish. Check the booking or boost payment status before retrying; a test payment may already be processing.";
    respond(response, 502, { error: safeMessage });
  } finally { checkoutRunning = false; }
}
