import { chromium, type Frame, type Locator, type Page } from "playwright-core";

type ProviderSession = {
  data?: { id?: unknown; attributes?: { checkout_url?: unknown; livemode?: unknown } };
};

export function checkoutSessionId(rawUrl: string, providedSessionId?: string): string {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Provide a PayMongo checkout URL."); }
  if (url.origin !== "https://checkout.paymongo.com" || url.username || url.password) {
    throw new Error("Only PayMongo Hosted Checkout URLs are allowed.");
  }
  const path = url.pathname.split("/").filter(Boolean);
  if (path.length !== 1) throw new Error("The checkout URL is not a PayMongo session link.");
  if (providedSessionId !== undefined) {
    if (!/^cs_[A-Za-z0-9_-]+$/.test(providedSessionId)) throw new Error("The payment server returned an invalid checkout session ID.");
    return providedSessionId;
  }
  const legacy = /^(cs_[A-Za-z0-9]+)(?:_client_[A-Za-z0-9]+)?$/.exec(path[0]);
  if (legacy) return legacy[1];
  throw new Error("The payment server did not provide a checkout session ID. Update the payment functions or use hosted test checkout.");
}

export async function verifySandboxCheckout(rawUrl: string, secret: string, providedSessionId?: string, request: typeof fetch = fetch): Promise<void> {
  const sessionId = checkoutSessionId(rawUrl, providedSessionId);
  if (!secret.startsWith("sk_test_")) throw new Error("A PayMongo test secret is required. Live keys are never accepted.");
  const response = await request(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` },
  });
  if (!response.ok) throw new Error("PayMongo could not verify this checkout session. No card details were entered.");
  const session = await response.json() as ProviderSession;
  if (session.data?.attributes?.livemode !== false) {
    throw new Error("This checkout is not confirmed as PayMongo test mode. No card details were entered.");
  }
  let providerUrl: URL;
  try { providerUrl = new URL(String(session.data.attributes.checkout_url)); }
  catch { throw new Error("PayMongo did not confirm this checkout link. No card details were entered."); }
  if (session.data.id !== sessionId || providerUrl.href !== new URL(rawUrl).href) {
    throw new Error("PayMongo returned a different checkout session. No card details were entered.");
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
  const attempts = required ? 40 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
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
    if (attempt < attempts - 1) await page.waitForTimeout(250);
  }
  if (required) throw new Error("The PayMongo card form changed. Complete this test checkout manually; no payment was submitted.");
  return false;
}

async function fillBlankAcrossFrames(page: Page, field: Field): Promise<void> {
  for (const frame of page.frames()) {
    const candidate = await firstVisible([
      ...field.labels.map((label) => frame.getByLabel(label)),
      ...field.selectors.map((selector) => frame.locator(selector)),
    ]);
    if (!candidate) continue;
    if (!(await candidate.inputValue()).trim()) await candidate.fill(field.value);
    return;
  }
}

async function chooseCountryIfMissing(page: Page): Promise<void> {
  for (const frame of page.frames()) {
    const country = await firstVisible([frame.getByLabel(/country/i), frame.locator('select[name*="country"]'),
      frame.locator('select:has(option:text-is("Philippines"))')]);
    if (!country) continue;
    const value = await country.inputValue().catch(() => "");
    if (value.trim()) return;
    if (await country.evaluate((element) => element.tagName === "SELECT")) {
      await country.selectOption({ label: "Philippines" });
      return;
    }
    await country.click();
    const option = await firstVisible([frame.getByRole("option", { name: /^philippines$/i })]);
    if (option) await option.click();
    return;
  }
}

async function fillSandboxBilling(page: Page): Promise<void> {
  await fillBlankAcrossFrames(page, { labels: [/cardholder|name on card|full name/i],
    selectors: ['input[autocomplete="cc-name"]'], value: "Test Customer" });
  await fillBlankAcrossFrames(page, { labels: [/^name$/i], selectors: ['input[autocomplete="name"]'], value: "Test Customer" });
  await fillBlankAcrossFrames(page, { labels: [/email/i], selectors: ['input[type="email"]', 'input[autocomplete="email"]'],
    value: "paymongo-test@example.com" });
  await fillBlankAcrossFrames(page, { labels: [/phone|mobile/i], selectors: ['input[type="tel"]'], value: "09171234567" });
  await chooseCountryIfMissing(page);
  await fillBlankAcrossFrames(page, { labels: [/address line 1/i], selectors: ['input[autocomplete="address-line1"]'], value: "123 Test Street" });
  await fillBlankAcrossFrames(page, { labels: [/^city$/i], selectors: ['input[autocomplete="address-level2"]'], value: "Manila" });
  await fillBlankAcrossFrames(page, { labels: [/state|province/i], selectors: ['input[autocomplete="address-level1"]'], value: "Metro Manila" });
  await fillBlankAcrossFrames(page, { labels: [/postal|zip/i], selectors: ['input[autocomplete="postal-code"]'], value: "1000" });
}

export async function fillSandboxCard(page: Page): Promise<void> {
  // Wait for the hosted form to hydrate before looking for optional billing fields.
  await page.locator('input[type="email"]:visible, input[autocomplete="cc-number"]:visible, input[placeholder*="1234 1234"]:visible')
    .or(page.getByText(/^card$/i)).or(page.getByRole("button", { name: /credit.*debit/i })).first()
    .waitFor({ state: "visible", timeout: 15_000 });
  // Hosted Checkout requires billing details before enabling its card step.
  await fillSandboxBilling(page);
  const cardNumber: Field = { labels: [/card number/i, /card no\.?/i],
    selectors: ['input[autocomplete="cc-number"]', 'input[name*="card_number"]', 'input[placeholder*="1234 1234"]'],
    value: "4343434343434345" };
  const expiry: Field = { labels: [/expir/i, /mm\s*\/\s*yy/i],
    selectors: ['input[autocomplete="cc-exp"]', 'input[name="expiry"]', 'input[placeholder="MM/YY"]'], value: "12/30" };
  const cvc: Field = { labels: [/cvc/i, /cvv/i, /security code/i],
    selectors: ['input[autocomplete="cc-csc"]', 'input[name*="cvc"]', 'input[name*="cvv"]'], value: "123" };
  if (!await fillAcrossFrames(page, cardNumber, false)) {
    const cardChoice = await firstVisible([
      page.getByRole("radio", { name: /card/i }), page.getByRole("button", { name: /^card$|credit.*debit/i }),
      page.getByText(/^credit\s*(?:\/|or|and)\s*debit card$/i), page.getByText(/^card$/i),
    ]);
    if (cardChoice) await cardChoice.click();
    const continueButton = await firstVisible([page.getByRole("button", { name: /^continue$/i })]);
    if (continueButton) await continueButton.click({ timeout: 5_000 });
    await fillAcrossFrames(page, cardNumber, true);
  }
  if (!await fillAcrossFrames(page, expiry, false)) {
    await fillAcrossFrames(page, { labels: [/^mm$/i, /expiration month/i],
      selectors: ['input[autocomplete="cc-exp-month"]', 'input[name*="exp_month"]', 'input[placeholder="01"]'], value: "12" }, true);
    await fillAcrossFrames(page, { labels: [/^yy$/i, /expiration year/i],
      selectors: ['input[autocomplete="cc-exp-year"]', 'input[name*="exp_year"]', 'input[placeholder="31"]'], value: "30" }, true);
  }
  await fillAcrossFrames(page, cvc, true);
  await fillSandboxBilling(page);
}

export async function submitSandboxCheckout(page: Page): Promise<void> {
  const submit = await firstVisible([
    page.getByRole("button", { name: /^pay(?:\s|$)|pay now|complete payment|confirm payment/i }),
    page.locator('button[type="submit"]'),
  ]);
  if (!submit) throw new Error("The PayMongo submit button could not be found. Review the hosted page manually.");
  await submit.click();
}

export async function submitSandboxCheckoutAndWaitForReturn(page: Page): Promise<string> {
  const isAppReturn = (url: URL) =>
    (url.pathname === "/bookings" && url.searchParams.get("payment") === "verifying") ||
    (url.pathname === "/profile" && url.searchParams.get("boostPayment") === "verifying");
  const returnRequest = page.waitForRequest((request) => {
      try { return request.isNavigationRequest() && isAppReturn(new URL(request.url())); }
      catch { return false; }
    }, { timeout: 90_000 }).then((request) => request.url());
  const returnNavigation = page.waitForURL((url) => isAppReturn(url), { timeout: 90_000 })
    .then(() => page.url());
  await submitSandboxCheckout(page);
  return Promise.any([returnRequest, returnNavigation]);
}

/** Read-only recovery after a hosted-page timeout; never submits a second charge. */
export async function sandboxSessionPaid(input: {
  amount: number; attemptId: string; checkoutSessionId: string; checkoutUrl: string;
  currency: string; kind: "booking" | "boost"; secret: string;
}, request: typeof fetch = fetch): Promise<boolean> {
  const response = await request(`https://api.paymongo.com/v1/checkout_sessions/${input.checkoutSessionId}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${input.secret}:`).toString("base64")}` },
  });
  if (!response.ok) return false;
  const session = await response.json() as { data?: { id?: unknown; attributes?: {
    checkout_url?: unknown; livemode?: unknown; metadata?: Record<string, unknown>;
    payments?: { id?: unknown; attributes?: Record<string, unknown> }[];
  } } };
  const attributes = session.data?.attributes;
  const referenceKey = input.kind === "booking" ? "payment_attempt_id" : "boost_attempt_id";
  if (session.data?.id !== input.checkoutSessionId || attributes?.livemode !== false
    || attributes.checkout_url !== input.checkoutUrl || attributes.metadata?.[referenceKey] !== input.attemptId) return false;
  return Boolean(attributes.payments?.some((payment) => payment.id && payment.attributes?.status === "paid"
    && payment.attributes.amount === Math.round(input.amount * 100)
    && payment.attributes.currency === input.currency));
}

export async function completeSandboxCheckout(
  rawUrl: string, secret: string, sessionId?: string,
  browserOptions: { executablePath?: string; args?: string[] } = {},
): Promise<string> {
  await verifySandboxCheckout(rawUrl, secret, sessionId);
  const browser = await chromium.launch({ headless: true, ...browserOptions });
  try {
    const page = await browser.newPage();
    await page.goto(rawUrl, { waitUntil: "load" });
    await fillSandboxCard(page);
    return await submitSandboxCheckoutAndWaitForReturn(page);
  } finally { await browser.close(); }
}
