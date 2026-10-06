import { expect, test } from '@playwright/test';
import { chooseBookingArea, chooseLocation, mockLocationOptions } from './helpers/locations';

const properties = { countrycode: 'PH', state: 'Bulacan', city: 'Guiguinto', district: 'Barangay Poblacion', street: 'Main Street', housenumber: '42' };
test.beforeEach(async ({ page }) => {
  await mockLocationOptions(page);
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }));
  await page.route('https://photon.komoot.io/reverse**', route => route.fulfill({ json: { features: [{ properties }] } }));
  await page.route('**/__trabawho_paymongo_sandbox_ready', route => route.fulfill({ json: { status: 'ready' } }));
  await page.route('**/__booking-journey*', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/booking-payment-journey.tsx"></script></body></html>` }));
});

for (const width of [390, 768, 1024, 1280, 1440]) test(`fills all address fields from a pin before selecting an area at ${width}px`, async ({ page, context }) => {
  let lookups = 0;
  page.on('request', request => { if (request.url().startsWith('https://photon.komoot.io/reverse')) lookups++; });
  await page.setViewportSize({ width, height: 900 });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 14.833, longitude: 120.883 });
  await page.goto('/__booking-journey?address');
  await page.getByRole('button', { name: 'Pin service location', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Pin service location', exact: true });
  await expect(picker.getByRole('button', { name: 'Use current location' })).toBeEnabled();
  await picker.getByRole('button', { name: 'Use current location' }).click();
  await expect(picker.getByRole('button', { name: 'Confirm service pin' })).toBeEnabled();
  expect(lookups).toBe(0);
  await picker.getByRole('button', { name: 'Confirm service pin' }).click();
  await expect(picker).toHaveCount(0);
  for (const [label, text] of [['Province', 'Bulacan'], ['City/Municipality', 'Guiguinto'], ['Barangay', 'Poblacion']]) {
    await expect(page.getByRole('combobox', { name: label, exact: true })).toHaveText(new RegExp(text));
  }
  await expect(page.getByLabel('Specific service address', { exact: true })).toHaveValue('42 Main Street');
  await expect(page.getByRole('link', { name: /View saved pin/ })).toHaveAttribute('href', /query=14\.833%2C120\.883/);
  expect(lookups).toBe(1);
  await page.getByLabel('Specific service address', { exact: true }).fill('Unit 5, 42 Main Street');
  await expect(page.getByRole('link', { name: /View saved pin/ })).toHaveAttribute('href', /query=14\.833%2C120\.883/);
});

test('cancelled address lookup cannot overwrite a new manual selection', async ({ page, context }) => {
  let requested = false;
  let release: () => void = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://photon.komoot.io/reverse**', async route => {
    requested = true; await waiting;
    await route.fulfill({ json: { features: [{ properties }] } }).catch(() => {});
  });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 14.833, longitude: 120.883 });
  await page.goto('/__booking-journey?address');
  await chooseBookingArea(page);
  await page.getByLabel('Specific service address', { exact: true }).fill('My manual address');
  await page.getByRole('button', { name: 'Pin service location', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Pin service location', exact: true });
  await expect(picker.getByRole('button', { name: 'Use current location' })).toBeEnabled();
  await picker.getByRole('button', { name: 'Use current location' }).click();
  await picker.getByRole('button', { name: 'Confirm service pin' }).click();
  await expect.poll(() => requested).toBe(true);
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await chooseLocation(page, 'City/Municipality', 'City of Malolos');
  await page.getByLabel('Specific service address', { exact: true }).fill('New manual address');
  release();
  await expect(page.getByRole('combobox', { name: 'City/Municipality', exact: true })).toHaveText(/City of Malolos/);
  await expect(page.getByLabel('Specific service address', { exact: true })).toHaveValue('New manual address');
  await expect(page.getByRole('link', { name: /View saved pin/ })).toHaveCount(0);
});

test('lookup failure keeps the confirmed pin and supports manual address entry', async ({ page, context }) => {
  await page.route('https://photon.komoot.io/reverse**', route => route.fulfill({ status: 503, json: {} }));
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 14.833, longitude: 120.883 });
  await page.goto('/__booking-journey?address');
  await chooseBookingArea(page);
  await page.getByLabel('Specific service address', { exact: true }).fill('My manual address');
  await page.getByRole('button', { name: 'Pin service location', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Pin service location', exact: true });
  await expect(picker.getByRole('button', { name: 'Use current location' })).toBeEnabled();
  await picker.getByRole('button', { name: 'Use current location' }).click();
  await picker.getByRole('button', { name: 'Confirm service pin' }).click();
  await expect(page.getByText(/Address lookup was unavailable/)).toBeVisible();
  await expect(page.getByLabel('Specific service address', { exact: true })).toHaveValue('My manual address');
  await expect(page.getByRole('link', { name: /View saved pin/ })).toHaveAttribute('href', /query=14\.833%2C120\.883/);
});
