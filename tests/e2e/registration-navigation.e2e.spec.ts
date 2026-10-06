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
      '1Account Details, current step', '2Email Verification, upcoming', '3Identity Verification, upcoming', '4Identity Review, upcoming',
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
    await expect(page.getByRole('heading', { name: 'Continue your registration', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Continue to identity', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
    expect(flow.requests.filter((item) => item.body.action === 'create')).toHaveLength(1);
    expect(flow.requests.filter((item) => item.body.action === 'save_name')).toHaveLength(0);
    expect(flow.requests.some((item) => ['resend', 'change_email'].includes(String(item.body.action)))).toBe(false);
    const primary = page.getByRole('button', { name: 'Verify with Didit' });
    const back = page.getByRole('button', { name: 'Back', exact: true });
    expect((await back.boundingBox())!.y).toBeGreaterThan((await primary.boundingBox())!.y);
    await expect(page.getByTestId('auth-task-panel')).toHaveCSS('scrollbar-width', 'none');
    if (width >= 1024) await expect(page.getByTestId('auth-task-panel')).toHaveCSS('overflow-y', 'auto');
    await expectNoRegistrationOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`registration-navigation-${width}.png`), fullPage: true });
  });
}

test('account details require email confirmation and reloading clears browser entries', async ({ page }) => {
  const flow = await mockAccountJourney(page);
  await page.goto('/register');
  await fillRegistration(page);
  await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
  expect(flow.requests.map(item => item.body.action)).toEqual(['create', 'state']);
  await expect(page.getByLabel('Complete name', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue('');
  expect(flow.requests.map(item=>item.body.action)).toEqual(['create', 'state']);
});

test('Back from identity keeps account details without requesting email', async ({ page }) => {
  const flow = await mockAccountJourney(page, { state: 'identity_pending', email: 'person@example.com', signupName: 'Ana Santos' });
  await page.goto('/register');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Continue your registration', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend confirmation email', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to identity', exact: true }).click();
  expect(flow.requests.map((item) => item.body.action)).toEqual(['state']);
});


for (const width of [390, 1440]) test(`hidden scrollbar preserves scrolling and keyboard access at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 640 });
  await mockAccountJourney(page, { state: 'identity_pending', signupName: 'Ana Santos' });
  await page.goto('/register');
  await page.getByRole('button', { name: 'Submit manually' }).click();
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


test('a legacy confirmed account resumes its session after identity approval', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Verify with Didit' }).click();
  await expect(page.getByRole('button', { name: 'Check verification status' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Name on your verified ID' })).toBeVisible();
  approved = true;
  await page.getByRole('button', { name: 'Confirm my legal name' }).click();
  await expect(page.getByRole('heading', { name: 'Your account is ready' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start booking services' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.pendingAccount.v2'))).toBeNull();
  await expect(page.getByRole('heading', { name: 'Confirm your email' })).toHaveCount(0);
});
