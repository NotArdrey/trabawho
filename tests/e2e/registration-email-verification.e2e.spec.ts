import { expect, test } from '@playwright/test';
import { corsHeaders, fillRegistration, mockAccountJourney } from './helpers/registration';

test('Back navigation and forged return parameters cannot skip identity review', async ({ page }) => {
  const flow = await mockAccountJourney(page, null, { state: 'identity_review', email: 'person@example.com' });
  await page.goto('/register?status=Approved&verificationSessionId=forged');
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to identity' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Resend confirmation email' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Verify with Didit' }).click();
  await expect(page.getByRole('heading', { name: 'Identity review pending' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Confirm your email' })).toHaveCount(0);
  expect(flow.requests.some(item => ['resend', 'change_email'].includes(String(item.body.action)))).toBe(false);
});

test('failed confirmation delivery after approval preserves the final email step', async ({ page }) => {
  const flow = await mockAccountJourney(page, null, { state: 'identity_review', email: 'person@example.com' });
  await page.goto('/register');
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Verify with Didit' }).click();
  await expect(page.getByRole('heading', { name: 'Identity review pending' })).toBeVisible();
  flow.setState({ state: 'email_pending', email: 'person@example.com', emailDelivery: { sent: false } });
  await page.getByRole('button', { name: 'Refresh review status' }).click();
  await expect(page.getByRole('status')).toContainText('confirmation email could not be sent');
  await expect(page.getByRole('link', { name: 'Start booking services' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resend confirmation email' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Confirmation email requested' })).toContainText('Check your inbox and spam folder');
  await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
  expect(flow.requests.filter(item => item.body.action === 'resend')).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Verify with Didit' })).toHaveCount(0);
});

test('changing email after approved review requests a new confirmation link', async ({ page }) => {
  const flow = await mockAccountJourney(page, null, { state: 'identity_review', email: 'person@example.com' });
  await page.goto('/register');
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Verify with Didit' }).click();
  await expect(page.getByRole('heading', { name: 'Identity review pending' })).toBeVisible();
  flow.setState({ state: 'email_pending', email: 'person@example.com', emailDelivery: { sent: true } });
  await page.getByRole('button', { name: 'Refresh review status' }).click();
  await page.getByRole('button', { name: 'Change email', exact: true }).click();
  await page.getByLabel('New email address', { exact: true }).fill('correct@example.com');
  await page.getByRole('button', { name: 'Save email and resend' }).click();
  await expect(page.getByText(/Check correct@example.com for the email/)).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('correct@example.com');
  expect(flow.requests.find(item => item.body.action === 'change_email')?.body.email).toBe('correct@example.com');
  await expect(page.getByRole('link', { name: 'Start booking services' })).toHaveCount(0);
});

test('email confirmed on another device signs in to the already reviewed account', async ({ page }) => {
  const flow = await mockAccountJourney(page, null, { state: 'identity_review', email: 'person@example.com' });
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'account-test', exp: expires, role: 'authenticated' })}.test`;
  const user = { id: 'account-test', email: 'person@example.com', email_confirmed_at: new Date().toISOString(),
    aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { registration_version: 3 } };
  await page.route('**/auth/v1/token*', route => route.fulfill({ headers: corsHeaders, json: {
    access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user,
  } }));
  await page.route('**/auth/v1/user', route => route.fulfill({ headers: corsHeaders, json: user }));
  await page.goto('/register');
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Verify with Didit' }).click();
  await expect(page.getByRole('heading', { name: 'Identity review pending' })).toBeVisible();
  flow.setState({ state: 'email_pending', email: 'person@example.com', emailDelivery: { sent: true } });
  await page.getByRole('button', { name: 'Refresh review status' }).click();
  await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  flow.confirmEmail();
  await page.getByRole('button', { name: 'Sign in and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Your account is ready', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start booking services' })).toBeVisible();
  expect(flow.requests.filter(item => item.body.action === 'create')).toHaveLength(1);
  expect(flow.requests.filter(item => item.name === 'account-didit-session' && item.body.acceptedIdentityTerms === true)).toHaveLength(1);
});
