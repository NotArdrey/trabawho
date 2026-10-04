import { expect, test } from '@playwright/test';
import { corsHeaders } from './helpers/registration';
test.beforeEach(async ({ page }) => {
  await page.route('**/__provider-journey', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/provider-setup-journey.tsx"></script></body></html>` }));
});
for (const width of [390,768,1024,1280,1440]) test(`provider setup collects service area and publishes after saving at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const calls: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/provider-setup', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    calls.push(route.request().postDataJSON() as Record<string, unknown>); return route.fulfill({ headers: corsHeaders, json: { saved: true } });
  });
  await page.goto('/__provider-journey');
  await expect(page.getByText('Maria Isabel de la Cruz Santos')).toBeVisible();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Specific service address')).toHaveCount(0);
  await page.getByLabel('Service type', { exact: true }).fill('Plumbing');
  await page.getByLabel('Describe your service').fill('Local plumbing repairs');
  await page.getByLabel('Province', { exact: true }).fill('Bulacan');
  await page.getByLabel('City/Municipality', { exact: true }).fill('Guiguinto');
  await page.getByLabel('Barangay', { exact: true }).fill('Poblacion');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Service price (PHP)').fill('500');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Save provider setup and publish gig' }).click();
  await expect(page.getByRole('heading', { name: 'Provider setup saved' })).toBeVisible();
  expect(calls).toEqual([expect.objectContaining({ serviceType: 'Plumbing', province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', fixedPrice: '500' })]);
  expect(calls[0]).not.toHaveProperty('fullName');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
