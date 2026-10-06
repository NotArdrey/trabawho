import { expect, test } from '@playwright/test';
import { corsHeaders, fillRegistration, mockAccountJourney } from './helpers/registration';
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from './helpers/supabase.js';

test('login, logout, then new signup does not restore the previous pending account', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sign-in');
  await page.evaluate(() => sessionStorage.setItem('trabawho.pendingAccount.v2', JSON.stringify({ userId: 'previous', nonce: 'old-capability', email: 'old@example.com' })));
  await page.getByLabel('Email', { exact: true }).fill(DEMO_ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
  // Also exercise cleanup of stale recovery from an older frontend bundle.
  await page.evaluate(() => {
    sessionStorage.setItem('trabawho.pendingAccount.v2', JSON.stringify({ userId: 'previous', nonce: 'old-capability', email: 'old@example.com' }));
    sessionStorage.setItem('trabawho.identitySignup.v1', 'legacy');
  });
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/(?:sign-in(?:\?.*)?)?$/);
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.identitySignup.v1'))).toBeNull();
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByRole('radio', { name: 'Client: Book a service', exact: true })).not.toBeChecked();
  await expect(page.getByText('old@example.com', { exact: false })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
});

for (const width of [390, 1440]) test(`abandoned signup clears browser entries at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const flow = await mockAccountJourney(page);
  await page.route('**/auth/v1/logout*', async (route) => route.fulfill({ headers: corsHeaders, status: 204 }));
  await page.goto('/register');
  await fillRegistration(page);
  await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
  const requestsBeforeReload = flow.requests.length;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeFocused();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
  expect(flow.requests.length).toBe(requestsBeforeReload);
  expect(flow.requests.some(item => item.body.action === 'resend')).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
});
