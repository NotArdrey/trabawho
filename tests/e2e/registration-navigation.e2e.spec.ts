import { expect, test } from '@playwright/test';
import { expectNoRegistrationOverflow, fillRegistration, mockAccountJourney } from './helpers/registration';

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`terms modal and registration Back preserve state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const flow = await mockAccountJourney(page);
    await page.goto('/register');
    const tabs = page.getByRole('navigation', { name: 'Account access' }).getByRole('button');
    await expect(tabs.nth(0)).toHaveText('Sign in');
    await expect(tabs.nth(1)).toHaveText('Create an account');
    await expect(page.getByRole('list', { name: 'Account verification steps' }).getByRole('listitem')).toHaveText([
      '1Account, current step', '2Name, upcoming', '3Email, upcoming', '4Identity, upcoming',
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
    await expect(page.getByRole('heading', { name: 'Account created', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to name', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to email', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
    expect(flow.requests.filter((item) => item.body.action === 'create')).toHaveLength(1);
    expect(flow.requests.filter((item) => item.body.action === 'save_name')).toHaveLength(1);
    expect(flow.requests.some((item) => ['resend', 'change_email'].includes(String(item.body.action)))).toBe(false);
    await expectNoRegistrationOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`registration-navigation-${width}.png`), fullPage: true });
  });
}

test('account creation precedes name entry and email confirmation; invalid names cannot advance', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Continue to email', exact: true }).click();
  await expect(page.getByLabel('Complete name', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Complete name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(flow.requests).toHaveLength(1);
  await page.getByLabel('Complete name', { exact: true }).fill('Ana María Santos');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Leave registration?' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay on registration' }).click();
  await page.getByRole('button', { name: 'Continue to name', exact: true }).click();
  await expect(page.getByLabel('Complete name', { exact: true })).toHaveValue('Ana María Santos');
  await page.getByRole('button', { name: 'Continue to email', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
  expect(flow.requests.map((item) => item.body.action)).toEqual(['create', 'save_name']);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
});

test('Back from identity keeps confirmed email and consent without requesting email', async ({ page }) => {
  const flow = await mockAccountJourney(page, { state: 'identity_pending', email: 'person@example.com', signupName: 'Ana Santos' });
  await page.goto('/register');
  await page.getByRole('checkbox', { name: /I consent to identity/ }).check();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Email confirmed', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend confirmation email', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to identity', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /I consent to identity/ })).toBeChecked();
  expect(flow.requests.map((item) => item.body.action)).toEqual(['state']);
});
