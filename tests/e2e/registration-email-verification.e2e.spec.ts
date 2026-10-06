import { expect, test } from '@playwright/test';
import { corsHeaders, fillRegistration, mockAccountJourney } from './helpers/registration';

test('Back navigation and forged return parameters cannot skip email verification', async ({ page }) => {
  const flow = await mockAccountJourney(page);
  await page.goto('/register?status=Approved&verificationSessionId=forged');
  await fillRegistration(page, 'person@example.com', 'client', false);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue to identity' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to email verification' }).click();
  await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Verify with Didit' })).toHaveCount(0);
  expect(flow.requests.some(item => item.name === 'account-didit-session')).toBe(false);
});

test('failed email delivery preserves the account and resend stays on the email gate', async ({ page }) => {
  const flow = await mockAccountJourney(page);
  await page.route('**/functions/v1/account-registration', async route => {
    if (route.request().method() === 'OPTIONS') return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action !== 'create') return route.fallback();
    flow.setState({ state: 'email_pending', email: 'person@example.com', emailDelivery: { sent: false } });
    await route.fulfill({ headers: corsHeaders, json: { state: 'email_pending', email: 'person@example.com',
      pendingAccount: { userId: 'account-test', nonce: 'recovery-test' }, emailDelivery: { sent: false } } });
  });
  await page.goto('/register');
  await fillRegistration(page, 'person@example.com', 'client', false);
  await expect(page.getByRole('status')).toContainText('confirmation email could not be sent');
  await page.getByRole('button', { name: 'Resend confirmation email' }).click();
  await expect(page.getByRole('status').filter({hasText:'Confirmation email requested'})).toContainText('Check your inbox and spam folder');
  await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
  expect(flow.requests.filter(item => item.body.action === 'resend')).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Verify with Didit' })).toHaveCount(0);
});

test('changing an unconfirmed email requests a new inbox link and keeps identity locked', async ({ page }) => {
  const flow = await mockAccountJourney(page);
  await page.goto('/register');
  await fillRegistration(page, 'person@example.com', 'client', false);
  await page.getByRole('button', { name: 'Change email', exact: true }).click();
  await page.getByLabel('New email address', { exact: true }).fill('correct@example.com');
  await page.getByRole('button', { name: 'Save email and resend' }).click();
  await expect(page.getByText(/Check correct@example.com for the email/)).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('correct@example.com');
  expect(flow.requests.find(item => item.body.action === 'change_email')?.body.email).toBe('correct@example.com');
  await expect(page.getByRole('button', { name: 'Verify with Didit' })).toHaveCount(0);
});

test('confirming email on another device resumes identity after sign-in', async ({ page }) => {
  const flow = await mockAccountJourney(page);
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'account-test', exp: expires, role: 'authenticated' })}.test`;
  const user = { id: 'account-test', email: 'person@example.com', email_confirmed_at: new Date().toISOString(),
    aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { registration_version: 4 } };
  await page.route('**/auth/v1/token*', route => route.fulfill({ headers: corsHeaders, json: {
    access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user,
  } }));
  await page.route('**/auth/v1/user', route => route.fulfill({ headers: corsHeaders, json: user }));
  await page.goto('/register');
  await fillRegistration(page, 'person@example.com', 'client', false);
  flow.confirmEmail();
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Sign in and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify with Didit' })).toBeEnabled();
  expect(flow.requests.filter(item => item.body.action === 'create')).toHaveLength(1);
});
