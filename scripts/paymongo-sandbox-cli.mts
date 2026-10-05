import { chromium } from "playwright-core";
import { loadEnv } from "vite";

import { fillSandboxCard, submitSandboxCheckoutAndWaitForReturn, verifySandboxCheckout } from "./paymongo-sandbox-checkout.mts";

async function main() {
  const rawUrl = process.argv[2] || process.env.PAYMONGO_TEST_CHECKOUT_URL;
  if (!rawUrl) throw new Error("Pass the test checkout URL or set PAYMONGO_TEST_CHECKOUT_URL.");
  const sessionId = process.argv[3] || process.env.PAYMONGO_TEST_CHECKOUT_SESSION_ID;
  const env = loadEnv("development", process.cwd(), "");
  const secret = process.env.PAYMONGO_SECRET_KEY || env.PAYMONGO_SECRET_KEY || "";
  await verifySandboxCheckout(rawUrl, secret, sessionId);
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    await page.goto(rawUrl, { waitUntil: "domcontentloaded" });
    await fillSandboxCard(page);
    console.info("Submitting a PayMongo test card and waiting for the app return...");
    await submitSandboxCheckoutAndWaitForReturn(page);
    console.info("Checkout returned to the application. Verify the booking or boost is marked paid by the webhook/reconciliation.");
  } finally { await browser.close(); }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Sandbox checkout failed."); process.exitCode = 1; });
