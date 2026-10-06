import { expect, test } from "@playwright/test";
import { corsHeaders } from './helpers/registration';
import { chooseBookingArea, chooseLocation, mockLocationOptions } from './helpers/locations';

test.beforeEach(async ({ page }) => {
  await mockLocationOptions(page);
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }));
  await page.route("**/__trabawho_paymongo_sandbox_ready", (route) => route.fulfill({ json: { status: "ready" } }));
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

for (const width of [390, 768, 1024, 1280, 1440]) test(`confirms an exact service pin and sends it to checkout at ${width}px`, async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width, height: 900 });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 14.833, longitude: 120.883 });
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/functions/v1/create-paymongo-checkout', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ headers: corsHeaders, json: { bookingId: 'booking-pin', paymentAttemptId: 'attempt-pin', checkoutUrl: 'https://checkout.paymongo.com/pin-test' } });
  });
  await page.route('https://checkout.paymongo.com/pin-test', route => route.fulfill({ contentType: 'text/html', body: '<h1>Pin captured</h1>' }));
  await page.goto('/__booking-journey?address');
  await expect(page.getByRole('button', { name: 'Pin service location', exact: true })).toBeDisabled();
  await chooseBookingArea(page);
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Service Street');
  await page.getByRole('button', { name: 'Pin service location', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Pin service location', exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('button', { name: 'Confirm service pin' })).toBeDisabled();
  await expect(picker.getByRole('button', { name: 'Use current location' })).toBeEnabled();
  await picker.getByRole('button', { name: 'Use current location' }).click();
  await expect(picker.getByRole('button', { name: 'Confirm service pin' })).toBeEnabled();
  await expect(picker.getByRole('link', { name: /OpenStreetMap contributors/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('service-pin-picker.png'), fullPage: true });
  await picker.getByRole('button', { name: 'Confirm service pin' }).click();
  const link = page.getByRole('link', { name: /View saved pin on Google Maps/ });
  await expect(link).toHaveAttribute('href', /query=14\.833%2C120\.883/);
  await page.getByRole('button', { name: 'Reserve and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Pin captured' })).toBeVisible();
  expect(submitted).toMatchObject({ serviceAddress: { province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion',
    address: '12 Service Street', pin: { latitude: 14.833, longitude: 120.883 } } });
  expect(errors).toEqual([]);
});

test('supports tapping, dragging, keyboard placement, cancel, and invalidates pins after address changes', async ({ page }) => {
  await page.goto('/__booking-journey?address');
  await chooseBookingArea(page);
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Service Street');
  await page.getByRole('button', { name: 'Pin service location', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Pin service location', exact: true });
  await expect(picker.getByRole('button', { name: 'Place pin at map center' })).toBeEnabled();
  const map = picker.getByRole('region', { name: 'Service location map' });
  await map.click({ position: { x: 120, y: 100 } });
  await picker.locator('summary').click();
  const latitude = picker.getByLabel('Latitude', { exact: true });
  const longitude = picker.getByLabel('Longitude', { exact: true });
  const oldLongitude = await longitude.inputValue();
  const marker = map.locator('.leaflet-marker-icon');
  const bounds = await marker.boundingBox();
  if (!bounds) throw new Error('Selected pin is missing');
  await page.mouse.move(bounds.x + 22, bounds.y + 22);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 70, bounds.y + 22, { steps: 6 });
  await page.mouse.up();
  await expect(longitude).not.toHaveValue(oldLongitude);
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await picker.getByRole('button', { name: 'Place pin at map center' }).focus();
  await page.keyboard.press('Enter');
  await latitude.fill('14.833');
  await longitude.fill('120.883');
  await picker.getByRole('button', { name: 'Confirm service pin' }).click();
  const saved = page.getByRole('link', { name: /View saved pin on Google Maps/ });
  await expect(saved).toHaveAttribute('href', /query=14\.833%2C120\.883/);
  await page.getByRole('button', { name: 'Edit service location pin' }).click();
  await picker.locator('summary').click();
  await picker.getByLabel('Latitude', { exact: true }).fill('15');
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(saved).toHaveAttribute('href', /query=14\.833%2C120\.883/);
  await expect(page.getByRole('button', { name: 'Edit service location pin' })).toBeFocused();
  await page.getByLabel('Specific service address', { exact: true }).fill('13 Service Street');
  await expect(page.getByRole('link', { name: /View saved pin/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pin service location', exact: true }).click();
  await picker.locator('summary').click();
  await picker.getByLabel('Latitude', { exact: true }).fill('14.833');
  await picker.getByLabel('Longitude', { exact: true }).fill('120.883');
  await picker.getByRole('button', { name: 'Confirm service pin' }).click();
  await chooseLocation(page, 'City/Municipality', 'City of Malolos');
  await expect(page.getByRole('link', { name: /View saved pin/ })).toHaveCount(0);
});

test('recovers from denied GPS and missing tiles with validated coordinates', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (_success: unknown, fail: (error: { code: number }) => void) => fail({ code: 1 }),
    } });
  });
  await page.goto('/__booking-journey?address');
  await chooseBookingArea(page);
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Service Street');
  await page.getByRole('button', { name: 'Pin service location', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Pin service location', exact: true });
  await expect(picker.getByText(/Map images could not be loaded/)).toBeVisible();
  await picker.getByRole('button', { name: 'Use current location' }).click();
  await expect(picker.getByRole('alert')).toContainText('permission was denied');
  await picker.locator('summary').click();
  await picker.getByLabel('Latitude', { exact: true }).fill('91');
  await picker.getByLabel('Longitude', { exact: true }).fill('120.883');
  await expect(picker.getByRole('button', { name: 'Confirm service pin' })).toBeDisabled();
  await picker.getByLabel('Latitude', { exact: true }).fill('14.833');
  await picker.getByRole('button', { name: 'Confirm service pin' }).click();
  await expect(page.getByRole('link', { name: /View saved pin on Google Maps/ })).toBeVisible();
  await page.getByRole('button', { name: 'Remove pin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pin service location', exact: true })).toBeVisible();
});

test('keeps a manually chosen pin when a delayed GPS response arrives', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (success: (position: { coords: { latitude: number; longitude: number } }) => void) => {
        Object.assign(window, { deliverLocation: () => success({ coords: { latitude: 10, longitude: 125 } }) });
      },
    } });
  });
  await page.goto('/__booking-journey?address');
  await chooseBookingArea(page);
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Service Street');
  await page.getByRole('button', { name: 'Pin service location', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Pin service location', exact: true });
  await expect(picker.getByRole('button', { name: 'Use current location' })).toBeEnabled();
  await picker.getByRole('button', { name: 'Use current location' }).click();
  await picker.locator('summary').click();
  await picker.getByLabel('Latitude', { exact: true }).fill('14.833');
  await picker.getByLabel('Longitude', { exact: true }).fill('120.883');
  await page.evaluate(() => (window as Window & { deliverLocation: () => void }).deliverLocation());
  await expect(picker.getByLabel('Latitude', { exact: true })).toHaveValue('14.833');
  await picker.getByRole('button', { name: 'Confirm service pin' }).click();
  await expect(page.getByRole('link', { name: /View saved pin/ })).toHaveAttribute('href', /query=14\.833%2C120\.883/);
});

test("one-click sandbox never creates a booking hold when setup is missing", async ({ page }) => {
  let checkoutCalls = 0;
  await page.route("**/__trabawho_paymongo_sandbox_ready", (route) => route.fulfill({
    status: 503, json: { error: "Add PAYMONGO_SECRET_KEY=sk_test_... to the ignored .env.local, then restart the dev server." },
  }));
  await page.route("**/functions/v1/create-paymongo-checkout", (route) => {
    checkoutCalls += 1;
    return route.fulfill({ status: 500 });
  });
  await page.goto("/__booking-journey");
  await expect(page.getByRole("dialog", { name: "Choose payment" })).toBeVisible();
  const shortcut = page.getByRole("button", { name: "One-click sandbox test payment" });
  if (await shortcut.isVisible()) {
    await shortcut.click();
    await expect(page.getByRole("alert")).toContainText("PAYMONGO_SECRET_KEY");
  } else {
    await expect(page.getByRole("button", { name: "Reserve and continue" })).toBeVisible();
  }
  expect(checkoutCalls).toBe(0);
});

test("one-click sandbox booking payment skips the hosted form and returns for verification", async ({ page }) => {
  let shortcutCalls = 0;
  await page.route("**/functions/v1/create-paymongo-checkout", (route) => route.fulfill({ json: {
    bookingId: "booking-1", paymentAttemptId: "attempt-1", holdExpiresAt: null,
    checkoutUrl: "https://checkout.paymongo.com/opaque-booking-token#public-key", checkoutSessionId: "cs_test123",
  } }));
  await page.route("**/__trabawho_paymongo_sandbox_checkout", (route) => {
    shortcutCalls += 1;
    expect(route.request().postDataJSON()).toEqual({
      checkoutUrl: "https://checkout.paymongo.com/opaque-booking-token#public-key", checkoutSessionId: "cs_test123",
      attemptId: "attempt-1", kind: "booking",
    });
    return route.fulfill({ json: { returnUrl: new URL("/bookings?payment=verifying&booking=booking-1&attempt=attempt-1", page.url()).toString() } });
  });
  await page.route("**/bookings?payment=verifying*", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Verifying sandbox payment</h1>" }));
  await page.goto("/__booking-journey");
  await page.getByRole("button", { name: "One-click sandbox test payment" }).click();
  await expect(page.getByRole("heading", { name: "Verifying sandbox payment" })).toBeVisible();
  expect(shortcutCalls).toBe(1);
});

test("one-click sandbox rejects a return to another site", async ({ page }) => {
  await page.route("**/functions/v1/create-paymongo-checkout", (route) => route.fulfill({ json: {
    bookingId: "booking-1", paymentAttemptId: "attempt-1", holdExpiresAt: null,
    checkoutUrl: "https://checkout.paymongo.com/opaque-booking-token#public-key", checkoutSessionId: "cs_test123",
  } }));
  await page.route("**/__trabawho_paymongo_sandbox_checkout", (route) => route.fulfill({ json: {
    returnUrl: "https://untrusted.example/bookings?payment=verifying&booking=booking-1&attempt=attempt-1",
  } }));
  await page.goto("/__booking-journey");
  await page.getByRole("button", { name: "One-click sandbox test payment" }).click();
  await expect(page.getByRole("alert")).toContainText("unexpected page");
  await expect(page.getByRole("dialog", { name: "Choose payment" })).toBeVisible();
});

for (const width of [390, 1280]) test(`remaining balance has one payment action in local development at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/__booking-journey?balance");
  await expect(page.getByRole("dialog", { name: "Choose payment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay remaining balance" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "One-click sandbox test payment" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
  await expect(page.getByRole('link', { name: /Search address on Google Maps/ })).toHaveAttribute('href', /12\+Service\+Street.*Poblacion.*Guiguinto.*Bulacan/);
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

test('checkout starts with the saved profile location and lets the client change it', async ({ page }) => {
  await page.goto('/__booking-journey?address&profile-address');
  await expect(page.getByText(/saved profile address is filled in/i)).toBeVisible();
  await expect(page.getByLabel('Specific service address', { exact: true })).toHaveValue('12 Profile Street');
  await expect(page.getByRole('link', { name: /Search address on Google Maps/ })).toHaveAttribute('href', /12\+Profile\+Street.*Poblacion.*Guiguinto.*Bulacan/);
  await page.getByLabel('Specific service address', { exact: true }).fill('45 Job Street');
  await page.getByRole('button', { name: 'Use profile address' }).click();
  await expect(page.getByLabel('Specific service address', { exact: true })).toHaveValue('12 Profile Street');
});

test('supports Metro Manila without a province', async ({ page }) => {
  await page.goto('/__booking-journey?address');
  await chooseLocation(page, 'Province', 'Metro Manila');
  await chooseLocation(page, 'City/Municipality', 'Quezon City');
  await chooseLocation(page, 'Barangay', 'Alicia');
  await page.getByLabel('Specific service address', { exact: true }).fill('12 Test Street');
  await expect(page.getByRole('link', { name: /Search address on Google Maps/ })).toHaveAttribute('href', /Quezon\+City.*Metro\+Manila/);
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
  await expect(page.getByRole('link', { name: /Search address on Google Maps/ })).toBeVisible();
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
