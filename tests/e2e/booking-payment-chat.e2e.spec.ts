import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__booking-journey*", async (route) => {
    await route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
      </script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/booking-payment-journey.tsx"></script></body></html>` });
  });
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`checkout shows correct installments and redirects once at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const calls: Record<string, unknown>[] = [];
    await page.route("**/functions/v1/create-paymongo-checkout", async (route) => {
      calls.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: { bookingId: "booking-1", paymentAttemptId: "attempt-1", holdExpiresAt: "2026-10-02T10:15:00Z", checkoutUrl: "https://checkout.paymongo.com/test" } });
    });
    await page.route("https://checkout.paymongo.com/test", async (route) => {
      await route.fulfill({ contentType: "text/html", body: "<h1>Sandbox checkout</h1>" });
    });
    await page.goto("/__booking-journey");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("GCash")).toHaveCount(0);
    await expect(page.getByText("PHP 696", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("PHP 1,296", { exact: true })).toBeVisible();
    await expect(page.getByText("PHP 600 due before work starts")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Reserve and continue" }).click();
    await expect(page.getByRole("heading", { name: "Sandbox checkout" })).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ serviceId: 1, slotId: 1, paymentPlan: "downpayment" });
    expect(calls[0]).not.toHaveProperty("amount");
  });
}

test("rapid Enter presses send one message without refreshing", async ({ page }) => {
  await page.goto("/__booking-journey?mode=chat");
  const input = page.getByRole("textbox", { name: "Message" });
  await input.fill("Send once");
  await input.press("Enter");
  await input.press("Enter");
  await input.press("Enter");
  await expect(page.getByLabel("Messages").getByText("Send once", { exact: true })).toHaveCount(1);
  await expect(input).toHaveValue("");
});

test("reviews payment first and requests agreement only when continuing to checkout", async ({ page }) => {
  let checkouts = 0;
  await page.route("**/functions/v1/create-paymongo-checkout", async (route) => {
    checkouts++;
    await route.fulfill({ json: { bookingId: "booking-1", paymentAttemptId: "attempt-1", holdExpiresAt: null, checkoutUrl: "https://checkout.paymongo.com/test" } });
  });
  await page.route("https://checkout.paymongo.com/test", async (route) => { await route.fulfill({ contentType: "text/html", body: "<h1>Checkout</h1>" }); });
  await page.goto("/__booking-journey?terms=1");
  await expect(page.getByRole("dialog", { name: "Choose payment" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Reserve and continue" }).click();
  await expect(page.getByRole("dialog", { name: "Review before payment" })).toBeVisible();
  await expect(page.getByText("Demo payment")).toHaveCount(0);
  expect(checkouts).toBe(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Choose payment" })).toBeVisible();
  await page.getByRole("button", { name: "Reserve and continue" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Agree and open checkout" }).click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  expect(checkouts).toBe(1);
});
