import { expect, test } from '@playwright/test';
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from './helpers/supabase.js';

const cases = [
  ['PENDING_REVIEW', 'Your identity review is still pending. We will email you when the review is approved.'],
  ['DECLINED', 'Identity verification was not completed. Please restart verified registration before logging in.'],
  ['APPROVED', 'Please confirm your email before logging in.'],
] as const;

for (const [status, message] of cases) {
  test(`blocked ${status} login preserves its reason and entered email`, async ({ page }) => {
    // Authenticate the demo account normally; replace only profile reads to
    // exercise access states without mutating its stored identity or role.
    await page.route('**/rest/v1/profiles*', route => route.fulfill({ json: [{
      user_id: 'identity-login-test', email: DEMO_ADMIN_EMAIL, full_name: 'Identity Login Test',
      role: 'client', account_status: 'active', identity_required: true,
      verification_status: status, is_verified: false,
    }] }));
    await page.route('**/rest/v1/worker_profiles*', route => route.fulfill({ json: [] }));
    await page.goto('/');
    await page.getByRole('button', { name: /^Sign in$/ }).first().click();
    await page.getByLabel('Email').fill(DEMO_ADMIN_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
    await page.locator('form').getByRole('button', { name: /^Sign in$/ }).click();
    await expect(page.getByText(message, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('Email')).toHaveValue(DEMO_ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/sign-in/);
  });
}
