import { chromium, type Frame, type Locator, type Page } from "@playwright/test";
import { loadEnv } from "vite";

type ProviderSession = {
  data?: { attributes?: { livemode?: unknown; payments?: unknown[] } };
};

export function checkoutSessionId(rawUrl: string): string {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Provide a PayMongo checkout URL."); }
  if (url.protocol !== "https:" || url.hostname !== "checkout.paymongo.com") {
    throw new Error("Only PayMongo Hosted Checkout URLs are allowed.");
  }
  const sessionId = url.pathname.split("/").filter(Boolean)[0];
  if (!sessionId || !/^cs_[A-Za-z0-9]+$/.test(sessionId)) {
    throw new Error("The checkout URL has no valid session ID.");
  }
  return sessionId;
}

export async function verifySandboxCheckout(rawUrl: string, secret: string, request: typeof fetch = fetch): Promise<void> {
  const sessionId = checkoutSessionId(rawUrl);
  if (!secret.startsWith("sk_test_")) throw new Error("A PayMongo test secret is required. Live keys are never accepted.");
  const response = await request(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` },
  });
  if (!response.ok) throw new Error("PayMongo could not verify this checkout session. No card details were entered.");
  const session = await response.json() as ProviderSession;
  if (session.data?.attributes?.livemode !== false) {
    throw new Error("This checkout is not confirmed as PayMongo test mode. No card details were entered.");
  }
}

type Field = { labels: RegExp[]; selectors: string[]; value: string };

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    const count = Math.min(await locator.count(), 4);
    for (let index = 0; index < count; index++) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return null;
}

async function fillAcrossFrames(page: Page, field: Field, required: boolean): Promise<boolean> {
  const frames: Frame[] = page.frames();
  for (const frame of frames) {
    const candidate = await firstVisible([
      ...field.labels.map((label) => frame.getByLabel(label)),
      ...field.selectors.map((selector) => frame.locator(selector)),
    ]);
    if (!candidate) continue;
    await candidate.fill(field.value);
    return true;
  }
  if (required) throw new Error("The PayMongo card form changed. Complete this test checkout manually; no payment was submitted.");
  return false;
}

export async function fillSandboxCard(page: Page): Promise<void> {
  const cardNumber: Field = { labels: [/card number/i, /card no\.?/i],
    selectors: ['input[autocomplete="cc-number"]', 'input[name*="card_number"]', 'input[placeholder*="1234"]'],
    value: "4343434343434345" };
  const expiry: Field = { labels: [/expir/i, /mm\s*\/\s*yy/i],
    selectors: ['input[autocomplete="cc-exp"]', 'input[name*="expir"]', 'input[placeholder*="MM"]'], value: "12/30" };
  const cvc: Field = { labels: [/cvc/i, /cvv/i, /security code/i],
    selectors: ['input[autocomplete="cc-csc"]', 'input[name*="cvc"]', 'input[name*="cvv"]'], value: "123" };
  if (!await fillAcrossFrames(page, cardNumber, false)) {
    const cardChoice = await firstVisible([
      page.getByRole("radio", { name: /card/i }), page.getByRole("button", { name: /^card$|credit.*debit/i }),
      page.getByText(/^credit\s*(?:\/|or|and)\s*debit card$/i),
    ]);
    if (cardChoice) await cardChoice.click();
    await fillAcrossFrames(page, cardNumber, true);
  }
  await fillAcrossFrames(page, expiry, true);
  await fillAcrossFrames(page, cvc, true);
  await fillAcrossFrames(page, { labels: [/cardholder|name on card|full name/i],
    selectors: ['input[autocomplete="cc-name"]', 'input[name="name"]'], value: "Test Customer" }, false);
  await fillAcrossFrames(page, { labels: [/email/i], selectors: ['input[type="email"]', 'input[autocomplete="email"]'],
    value: "paymongo-test@example.com" }, false);
  await fillAcrossFrames(page, { labels: [/phone|mobile/i], selectors: ['input[type="tel"]'], value: "09171234567" }, false);
}

export async function submitSandboxCheckout(page: Page): Promise<void> {
  const submit = await firstVisible([
    page.getByRole("button", { name: /^pay(?:\s|$)|pay now|complete payment|confirm payment/i }),
    page.locator('button[type="submit"]'),
  ]);
  if (!submit) throw new Error("The PayMongo submit button could not be found. Review the hosted page manually.");
  await submit.click();
}

async function main() {
  const rawUrl = process.argv[2] || process.env.PAYMONGO_TEST_CHECKOUT_URL;
  if (!rawUrl) throw new Error("Pass the test checkout URL or set PAYMONGO_TEST_CHECKOUT_URL.");
  const env = loadEnv("development", process.cwd(), "");
  const secret = process.env.PAYMONGO_SECRET_KEY || env.PAYMONGO_SECRET_KEY || "";
  await verifySandboxCheckout(rawUrl, secret);
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    await page.goto(rawUrl, { waitUntil: "domcontentloaded" });
    await fillSandboxCard(page);
    await submitSandboxCheckout(page);
    console.info("Submitted a PayMongo test card. Waiting for the provider's confirmation and app return...");
    await page.waitForURL((url) =>
      (url.pathname === "/bookings" && url.searchParams.get("payment") === "verifying") ||
      (url.pathname === "/profile" && url.searchParams.get("boostPayment") === "verifying"),
    { timeout: 120_000 });
    console.info("Checkout returned to the application. Verify the booking or boost is marked paid by the webhook/reconciliation.");
  } finally { await browser.close(); }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/paymongo-sandbox-checkout.mts")) {
  main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Sandbox checkout failed."); process.exitCode = 1; });
}
