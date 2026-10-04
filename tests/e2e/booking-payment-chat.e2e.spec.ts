import { expect, test } from "@playwright/test";
import { corsHeaders } from './helpers/registration';
import { chooseBookingArea, chooseLocation, mockLocationOptions } from './helpers/locations';

test.beforeEach(async ({ page }) => {
  await mockLocationOptions(page);
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

for (const width of [390,768,1024,1280,1440]) test(`new booking collects its service address at checkout at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const calls: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/create-paymongo-checkout', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    calls.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ headers: corsHeaders, json: { bookingId: 'booking-address', paymentAttemptId: 'attempt', checkoutUrl: 'https://checkout.paymongo.com/address-test' } });
  });
  await page.route('https://checkout.paymongo.com/address-test', route => route.fulfill({ contentType: 'text/html', body: '<h1>Address captured</h1>' }));
  await page.goto('/__booking-journey?address');
  await page.getByRole('button', { name: 'Reserve and continue' }).click();
  await expect(page.getByRole('alert')).toContainText('specific service address');
  expect(calls).toHaveLength(0);
  await chooseBookingArea(page);
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Service Street');
  await expect(page.getByRole('link', { name: /View on Google Maps/ })).toHaveAttribute('href', /12\+Service\+Street.*Poblacion.*Guiguinto.*Bulacan/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('booking-location.png'), fullPage: true });
  await page.getByRole('button', { name: 'Reserve and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Address captured' })).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ serviceAddress: { province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address: '12 Service Street' } });
});

test('location controls support keyboard selection and reset dependent fields', async ({ page }) => {
  await page.goto('/__booking-journey?address');
  await expect(page.getByRole('combobox', { name: 'City/Municipality', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Barangay', exact: true })).toBeDisabled();
  const province = page.getByRole('combobox', { name: 'Province', exact: true });
  await expect(province).toBeEnabled();
  await province.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('b');
  await page.keyboard.press('Enter');
  await expect(province).toContainText('Bulacan');
  await chooseLocation(page, 'City/Municipality', 'Guiguinto');
  await chooseLocation(page, 'Barangay', 'Poblacion');
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Service Street');
  await chooseLocation(page, 'City/Municipality', 'City of Malolos');
  await expect(page.getByRole('combobox', { name: 'Barangay', exact: true })).toContainText('Select barangay');
  await expect(page.getByLabel('Specific service address', { exact: true })).toHaveValue('');
  await chooseLocation(page, 'Barangay', 'Bulihan');
  await chooseLocation(page, 'Province', 'Nueva Ecija');
  await expect(page.getByRole('combobox', { name: 'City/Municipality', exact: true })).toContainText('Select city/municipality');
  await expect(page.getByRole('combobox', { name: 'Barangay', exact: true })).toBeDisabled();
});

test('supports Metro Manila without a province', async ({ page }) => {
  await page.goto('/__booking-journey?address');
  await chooseLocation(page, 'Province', 'Metro Manila');
  await chooseLocation(page, 'City/Municipality', 'Quezon City');
  await chooseLocation(page, 'Barangay', 'Alicia');
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Test Street');
  await expect(page.getByRole('link', { name: /View on Google Maps/ })).toHaveAttribute('href', /Quezon\+City.*Metro\+Manila/);
});

test('retries failed location requests and offers manual entry without blocking checkout', async ({ page }) => {
  let failed = true;
  await page.route('https://psgc.gitlab.io/api/provinces/', route => route.fulfill(failed
    ? { status: 503, json: {} } : { json: [{ code: '031400000', name: 'Bulacan' }] }));
  await page.goto('/__booking-journey?address');
  await expect(page.getByRole('alert')).toContainText('Location options could not be loaded');
  failed = false;
  await page.getByRole('button', { name: 'Retry locations' }).click();
  await chooseBookingArea(page);
  await expect(page.getByText('Location options could not be loaded')).toHaveCount(0);
  failed = true;
  await page.reload();
  await page.getByRole('button', { name: 'Enter location manually' }).click();
  await page.getByLabel('Province', { exact: true }).fill('Bulacan');
  await page.getByLabel('City/Municipality', { exact: true }).fill('Guiguinto');
  await page.getByLabel('Barangay', { exact: true }).fill('Poblacion');
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Service Street');
  await expect(page.getByRole('link', { name: /View on Google Maps/ })).toBeVisible();
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
