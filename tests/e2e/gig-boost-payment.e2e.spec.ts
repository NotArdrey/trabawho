import { expect, test } from "@playwright/test";

const attempt = "b93376bb-8ed9-4c03-a754-6cd512e32ff7";
const gig = { id: 83, title: "Handyman Home Repairs", metadata: {} };
test.beforeEach(async ({ page }) => {
  await page.route("**/__boost-journey*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/gig-boost-journey.tsx"></script></body></html>` }));
  await page.route("**/rest/v1/services?*", (route) => route.fulfill({ json: [gig] }));
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`reviews the full boost cost and opens PayMongo once at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const calls: Record<string, unknown>[] = [];
    await page.route("**/functions/v1/create-paymongo-boost-checkout", async (route) => {
      calls.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: { checkoutUrl: "https://checkout.paymongo.com/boost-test", attemptId: attempt } });
    });
    await page.route("https://checkout.paymongo.com/boost-test", (route) => route.fulfill({ contentType: "text/html", body: "<h1>PayMongo boost checkout</h1>" }));
    await page.goto("/__boost-journey");
    if (width >= 1024) {
      const durationBox = await page.getByRole("combobox", { name: "Boost duration" }).boundingBox();
      const priceBox = await page.getByText("PHP 50", { exact: true }).boundingBox();
      expect(durationBox && priceBox && Math.abs(durationBox.y - priceBox.y) <= 1).toBe(true);
    }
    await page.getByRole("button", { name: "Review boost payment" }).click();
    await expect(page.getByRole("dialog", { name: "Review gig boost payment" })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("PHP 350", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Price per day");
    await expect(page.getByRole("dialog")).toContainText("PHP 50");
    await expect(page.getByRole("dialog").getByText("7 days", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to PayMongo" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Continue to PayMongo" }).click();
    await expect(page.getByRole("heading", { name: "PayMongo boost checkout" })).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ serviceId: 83, days: 7, amount: 350 });
    expect(calls[0]).not.toHaveProperty("active");
  });
}

test("cancelled checkout leaves the gig inactive", async ({ page }) => {
  await page.route("**/functions/v1/reconcile-paymongo-boost-checkout", (route) => route.fulfill({ json: { status: "awaiting_payment", verified: false, requiresReview: false, serviceId: 83, endsAt: null } }));
  await page.goto(`/__boost-journey?boostPayment=cancelled&boostAttempt=${attempt}`);
  await expect(page.getByRole("status").filter({ hasText: "Your gig boost is inactive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review boost payment" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Gig already boosted" })).toHaveCount(0);
});

test("duration uses fixed, keyboard-accessible choices and updates the price", async ({ page }) => {
  await page.goto("/__boost-journey");
  const duration = page.getByRole("combobox", { name: "Boost duration" });
  await duration.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option")).toHaveText(["3 days", "7 days", "14 days", "30 days"]);
  await page.getByRole("option", { name: "14 days" }).click();
  await expect(duration).toHaveText("14 days");
  await expect(page.getByLabel("Budget PHP")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Total price · 14 days");
  await expect(page.getByRole("status")).toContainText("PHP 700");
  await page.getByRole("button", { name: "Review boost payment" }).click();
  await expect(page.getByRole("dialog")).toContainText("14 days");
  await expect(page.getByRole("dialog")).toContainText("PHP 700");
  await expect(page.getByRole("dialog")).not.toContainText("budget");
});

test("paid return refreshes the gig only after verification", async ({ page }) => {
  let paid = false;
  await page.route("**/rest/v1/services?*", (route) => route.fulfill({ json: [{ ...gig, metadata: paid ? { ad_booster: {
    active: true, payment_verified: true, budget_php: 250, starts_at: new Date(Date.now() - 1000).toISOString(),
    ends_at: new Date(Date.now() + 7 * 86400_000).toISOString(), payment: { provider: "paymongo", status: "paid" },
  } } : {} }] }));
  await page.route("**/functions/v1/reconcile-paymongo-boost-checkout", async (route) => {
    paid = true;
    await route.fulfill({ json: { status: "paid", verified: true, requiresReview: false, serviceId: 83, endsAt: new Date(Date.now() + 7 * 86400_000).toISOString() } });
  });
  await page.goto(`/__boost-journey?boostPayment=verifying&boostAttempt=${attempt}`);
  await expect(page.getByRole("status").filter({ hasText: "Payment verified" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gig already boosted" })).toBeDisabled();
  await expect(page).not.toHaveURL(/boostAttempt=/);
});

test("an old paid return does not claim an expired boost is active", async ({ page }) => {
  await page.route("**/functions/v1/reconcile-paymongo-boost-checkout", (route) => route.fulfill({ json: {
    status: "paid", verified: true, requiresReview: false, serviceId: 83, endsAt: new Date(Date.now() - 1000).toISOString(),
  } }));
  await page.goto(`/__boost-journey?boostPayment=verifying&boostAttempt=${attempt}`);
  await expect(page.getByRole("status").filter({ hasText: "This boost has ended" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review boost payment" })).toBeEnabled();
  await expect(page).not.toHaveURL(/boostAttempt=/);
});

test("failed gig reload reports an error and a later retry recovers", async ({ page }) => {
  let requests = 0;
  await page.route("**/rest/v1/services?*", (route) => {
    requests++;
    return requests <= 2
      ? route.fulfill({ status: 400, json: { message: "Unable to load services" } })
      : route.fulfill({ json: [gig] });
  });
  await page.goto("/__boost-journey");
  await expect(page.getByRole("alert")).toContainText("Unable to load your gigs");
  await page.getByRole("button", { name: "Reload gigs" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to load your gigs");
  await page.getByRole("button", { name: "Reload gigs" }).click();
  await expect(page.getByRole("button", { name: "Review boost payment" })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
