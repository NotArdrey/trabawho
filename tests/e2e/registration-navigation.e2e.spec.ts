import { expect, test } from '@playwright/test';
import { corsHeaders, expectNoRegistrationOverflow, fillRegistration, mockAccountJourney } from './helpers/registration';

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`terms modal and registration Back preserve state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const flow = await mockAccountJourney(page);
    await page.goto('/register');
    const tabs = page.getByRole('navigation', { name: 'Account access' }).getByRole('button');
    await expect(tabs.nth(0)).toHaveText('Sign in');
    await expect(tabs.nth(1)).toHaveText('Create an account');
    await expect(page.getByRole('list', { name: 'Account verification steps' }).getByRole('listitem')).toHaveText([
      '1Account, current step', '2Name, upcoming', '3Identity, upcoming',
    ]);
    const terms = page.getByRole('button', { name: 'Terms and Conditions', exact: true });
    await terms.focus();
    await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog', { name: 'Terms and Conditions', exact: true });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('marketplace responsibly');
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(terms).toBeFocused();
    await expect(page.getByRole('checkbox', { name: 'I agree to the Terms and Conditions' })).not.toBeChecked();
    expect(flow.requests).toHaveLength(0);
    await fillRegistration(page);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your name', exact: true })).toBeFocused();
    await expect(page.getByLabel('Complete name', { exact: true })).toHaveValue('Maria Isabel de la Cruz Santos');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Continue your registration', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to name', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to identity', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
    expect(flow.requests.filter((item) => item.body.action === 'create')).toHaveLength(1);
    expect(flow.requests.filter((item) => item.body.action === 'save_name')).toHaveLength(1);
    expect(flow.requests.some((item) => ['resend', 'change_email'].includes(String(item.body.action)))).toBe(false);
    const primary = page.getByRole('button', { name: 'Start identity verification' });
    const back = page.getByRole('button', { name: 'Back', exact: true });
    expect((await back.boundingBox())!.y).toBeGreaterThan((await primary.boundingBox())!.y);
    await expect(page.getByTestId('auth-task-panel')).toHaveCSS('scrollbar-width', 'none');
    if (width >= 1024) await expect(page.getByTestId('auth-task-panel')).toHaveCSS('overflow-y', 'auto');
    await expectNoRegistrationOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`registration-navigation-${width}.png`), fullPage: true });
  });
}

test('account creation precedes name entry and identity verification; invalid names cannot advance', async ({ page }) => {
  const flow = await mockAccountJourney(page);
  await page.goto('/register');
  await page.getByRole('radio', { name: 'Client: Book a service', exact: true }).check();
  await page.getByLabel('Email', { exact: true }).fill('person@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Password123!');
  await page.getByRole('checkbox', { name: 'I agree to the Terms and Conditions', exact: true }).check();
  expect(flow.requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your name', exact: true })).toBeVisible();
  expect(flow.requests.map((item) => item.body.action)).toEqual(['create']);
  await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to identity', exact: true }).click();
  await expect(page.getByLabel('Complete name', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Complete name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(flow.requests).toHaveLength(1);
  await page.getByLabel('Complete name', { exact: true }).fill('Ana María Santos');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back to home' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Leave registration?' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay on registration' }).click();
  await page.getByRole('button', { name: 'Continue to name', exact: true }).click();
  await expect(page.getByLabel('Complete name', { exact: true })).toHaveValue('Ana María Santos');
  await page.getByRole('button', { name: 'Continue to identity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
  expect(flow.requests.map((item) => item.body.action)).toEqual(['create', 'save_name']);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
});

test('Back from identity keeps the name and consent without requesting email', async ({ page }) => {
  const flow = await mockAccountJourney(page, { state: 'identity_pending', email: 'person@example.com', signupName: 'Ana Santos' });
  await page.goto('/register');
  await page.getByRole('checkbox', { name: /I consent to identity/ }).check();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your name', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend confirmation email', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to identity', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /I consent to identity/ })).toBeChecked();
  expect(flow.requests.map((item) => item.body.action)).toEqual(['state']);
});


for (const width of [390, 1440]) test(`hidden scrollbar preserves scrolling and keyboard access at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 640 });
  await mockAccountJourney(page, { state: 'identity_pending', signupName: 'Ana Santos' });
  await page.goto('/register');
  await page.getByRole('checkbox', { name: /I consent to identity/ }).check();
  await page.getByRole('button', { name: 'Use manual identity review instead' }).click();
  const panel = page.getByTestId('auth-task-panel');
  await expect(panel).toHaveCSS('scrollbar-width', 'none');
  if (width >= 1024) {
    expect(await panel.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await panel.hover();
    await page.mouse.wheel(0, 500);
    await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  } else {
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  }
  const input = page.getByLabel('Name on ID', { exact: true });
  await input.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Government document type')).toBeFocused();
  await expectNoRegistrationOverflow(page);
});

test('manual approval is detected automatically without an email screen', async ({ page }) => {
  const flow = await mockAccountJourney(page, { state: 'identity_review', signupName: 'Ana Santos' });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Identity review pending' })).toBeVisible();
  flow.setState({ state: 'ready', signupName: 'Ana Santos' });
  await expect(page.getByRole('heading', { name: 'Your account is ready' })).toBeVisible({ timeout: 12_000 });
  await expect(page.getByRole('heading', { name: 'Confirm your email' })).toHaveCount(0);
});


test('a newly created account receives its session automatically after identity approval', async ({ page }) => {
  await mockAccountJourney(page);
  let approved = false;
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'account-test', exp: expires, role: 'authenticated' })}.test`;
  const user = { id: 'account-test', email: 'person@example.com', email_confirmed_at: new Date().toISOString(), aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { registration_version: 2 } };
  await page.route('**/auth/v1/user', route => route.fulfill({ headers: corsHeaders, json: user }));
  await page.route('**/functions/v1/account-registration', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (!approved || body.action !== 'state') return route.fallback();
    return route.fulfill({ headers: corsHeaders, json: {
      state: 'ready', signupName: 'Maria Isabel de la Cruz Santos', signupRole: 'client',
      ...(body.userId ? { session: { access_token: accessToken, refresh_token: 'completed-refresh' } } : {}),
    } });
  });
  await page.goto('/register');
  await fillRegistration(page);
  await page.getByRole('checkbox', { name: /I consent to identity/ }).check();
  await page.getByRole('button', { name: 'Start identity verification' }).click();
  await page.getByRole('button', { name: 'Check verification status' }).click();
  await expect(page.getByRole('heading', { name: 'Name on your verified ID' })).toBeVisible();
  approved = true;
  await page.getByRole('button', { name: 'Confirm my legal name' }).click();
  await expect(page.getByRole('heading', { name: 'Your account is ready' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start booking services' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
  await expect(page.getByRole('heading', { name: 'Confirm your email' })).toHaveCount(0);
});
