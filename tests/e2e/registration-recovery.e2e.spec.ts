import { expect, test } from '@playwright/test';
import { corsHeaders, expectNoRegistrationOverflow, mockAccountJourney } from './helpers/registration';

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`rejected registration offers sign-in and Back preserves saved details at ${width}px`, async ({ page }) => {
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
    const signIn = page.getByRole('link', { name: 'Sign in to continue', exact: true });
    await expect(signIn).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry loading registration' })).toHaveCount(0);
    await expect(page.getByText('Check your connection and try again.', { exact: false })).toHaveCount(0);
    const back = page.getByRole('button', { name: 'Back', exact: true });
    expect((await back.boundingBox())!.y).toBeGreaterThan((await signIn.boundingBox())!.y);
    await back.click();
    await expect(page.getByRole('heading', { name: 'Your name', exact: true })).toBeFocused();
    await expect(page.getByText('Ana Santos', { exact: true })).toBeVisible();
    await back.click();
    await expect(page.getByText('person@example.com', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to name', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to identity', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toContain('Ana Santos');
    await expectNoRegistrationOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`registration-recovery-${width}.png`), fullPage: true });
    await signIn.click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  });
}

test('connection failure can retry restoration without discarding pending registration', async ({ page }) => {
  await mockAccountJourney(page);
  await page.addInitScript(() => sessionStorage.setItem('trabawho.pendingAccount.v2', JSON.stringify({
    userId: 'account-test', nonce: 'recovery-test', email: 'person@example.com', signupName: 'Ana Santos',
  })));
  let unavailable = true;
  await page.route('**/functions/v1/account-registration', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    if (unavailable) return route.fulfill({ status: 503, headers: corsHeaders, json: { error: 'Registration could not be loaded. Retry.' } });
    return route.fallback();
  });
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Retry loading registration' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Retry loading registration' }).click();
  await expect(page.getByRole('button', { name: 'Start identity verification' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry loading registration' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Complete name', { exact: true })).toHaveValue('Ana Santos');
});

test('a rejected cached login session restores through recovery for the same account', async ({ page }) => {
  const flow = await mockAccountJourney(page, { state: 'identity_pending', email: 'person@example.com', signupName: 'Ana Santos' });
  await page.addInitScript(() => sessionStorage.setItem('trabawho.pendingAccount.v2', JSON.stringify({
    userId: 'account-test', nonce: 'recovery-test', email: 'person@example.com', signupName: 'Ana Santos',
  })));
  let rejectedSession = false;
  await page.route('**/functions/v1/account-registration', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    if (!route.request().postDataJSON().userId) {
      rejectedSession = true;
      return route.fulfill({ status: 401, headers: corsHeaders, json: { error: 'Sign in to continue your registration.' } });
    }
    return route.fallback();
  });
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Start identity verification' })).toBeVisible();
  expect(rejectedSession).toBe(true);
  expect(flow.requests.some(request => request.body.userId === 'account-test' && request.body.nonce === 'recovery-test')).toBe(true);
  await expect(page.getByRole('link', { name: 'Sign in to continue', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toContain('Ana Santos');
});
