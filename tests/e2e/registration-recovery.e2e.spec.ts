import { expect, test } from '@playwright/test';
import { corsHeaders, expectNoRegistrationOverflow, mockAccountJourney } from './helpers/registration';

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`stale anonymous progress starts fresh even when recovery is unavailable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAccountJourney(page);
    await page.addInitScript(() => sessionStorage.setItem('trabawho.pendingAccount.v2', JSON.stringify({
      userId: 'account-test', nonce: 'recovery-test', email: 'person@example.com', signupName: 'Ana Santos',
    })));
    await page.route('**/functions/v1/account-registration', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill({ status: 401, headers: corsHeaders, json: { error: 'Sign in to continue your registration.' } });
    });
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry loading registration' })).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
    await expectNoRegistrationOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`registration-recovery-${width}.png`), fullPage: true });
  });
}

test('an authenticated account can retry a temporary registration lookup failure', async ({ page }) => {
  await mockAccountJourney(page, { state: 'identity_pending', email: 'person@example.com', signupName: 'Ana Santos' });
  let unavailable = true;
  await page.route('**/functions/v1/account-registration', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    if (unavailable) return route.fulfill({ status: 503, headers: corsHeaders, json: { error: 'Registration could not be loaded. Retry.' } });
    return route.fallback();
  });
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Retry loading registration' })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Retry loading registration' }).click();
  await expect(page.getByRole('button', { name: 'Verify with Didit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry loading registration' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('person@example.com', { exact: true })).toBeVisible();
});

test('a rejected authenticated session requires sign-in and cannot use stale anonymous progress', async ({ page }) => {
  const flow = await mockAccountJourney(page, { state: 'identity_pending', email: 'person@example.com', signupName: 'Ana Santos' });
  await page.addInitScript(() => sessionStorage.setItem('trabawho.pendingAccount.v2', JSON.stringify({
    userId: 'account-test', nonce: 'recovery-test', email: 'person@example.com', signupName: 'Ana Santos',
  })));
  await page.route('**/functions/v1/account-registration', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    return route.fulfill({ status: 401, headers: corsHeaders, json: { error: 'Sign in to continue your registration.' } });
  });
  await page.goto('/register');
  await expect(page.getByRole('link', { name: 'Sign in to continue', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify with Didit' })).toHaveCount(0);
  expect(flow.requests.some(request => request.body.nonce === 'recovery-test')).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
  await page.getByRole('link', { name: 'Sign in to continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});
