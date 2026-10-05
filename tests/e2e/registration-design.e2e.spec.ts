import { expect, test } from '@playwright/test';
import { corsHeaders, expectNoRegistrationOverflow, fillManualEvidence, mockAccountJourney } from './helpers/registration';

for (const width of [390, 768, 1024, 1280, 1440]) {
  test('registration uses visible progress and a responsive task panel at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAccountJourney(page);
    await page.goto('/register');
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Account verification steps' }).locator('[aria-current="step"]')).toContainText('Account');
    await expect(page.getByRole('navigation', { name: 'Account access' }).locator('[aria-current="page"]')).toContainText('Create an account');
    const visual = page.getByRole('complementary', { name: 'TrabaWho marketplace preview' });
    if (width >= 1024) {
      await expect(visual).toBeVisible();
      const imageBounds = await visual.boundingBox();
      const formBounds = await page.getByTestId('auth-task-panel').boundingBox();
      expect(imageBounds!.width).toBeGreaterThan(formBounds!.width);
    } else await expect(visual).toBeHidden();
    await expectNoRegistrationOverflow(page);
    await page.screenshot({ path: test.info().outputPath('registration-' + width + '.png'), fullPage: true });
  });
}

test('keyboard navigation preserves a draft when leaving is cancelled', async ({ page }) => {
  await mockAccountJourney(page);
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill('draft@example.com');
  await page.getByLabel('Password', { exact: true }).fill('PrivatePassword123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('PrivatePassword123!');
  await page.getByRole('button', { name: 'Already have an account? Sign in' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'Leave registration?' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Stay on registration' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('PrivatePassword123!');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('PrivatePassword123!');
  await expect(page.getByRole('button', { name: 'Already have an account? Sign in' })).toBeFocused();
});

test('manual Previous navigation preserves evidence and associates corrective errors', async ({ page }) => {
  const flow = await mockAccountJourney(page, { state: 'identity_pending' });
  await page.goto('/register');
  await page.getByRole('button', { name: 'Submit manually' }).click();
  await fillManualEvidence(page);
  await page.getByRole('button', { name: 'Back to verification options', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Submit manually' }).click();
  await expect(page.getByLabel('Name on ID', { exact: true })).toHaveValue('Manual User');
  expect(await page.locator('#manual-front-image').evaluate((element) => (element as HTMLInputElement).files?.[0]?.name)).toBe('front.png');
  await page.locator('#manual-front-image').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') });
  await page.getByRole('button', { name: 'Submit for human review' }).click();
  await expect(page.locator('#manual-front-image')).toBeFocused();
  await expect(page.locator('#manual-front-image')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#manual-front-error')).toContainText('JPEG, PNG, or WebP');
  expect(flow.requests.filter((item) => item.name === 'account-manual-review')).toHaveLength(0);
});

test('failed account creation keeps the entered password available for retry', async ({ page }) => {
  await page.route('**/functions/v1/account-registration', async (route) => route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: corsHeaders })
    : route.fulfill({ status: 503, headers: corsHeaders, json: { error: 'Account setup could not be saved. Retry.' } }));
  await page.goto('/register');
  await page.getByRole('radio', { name: 'Worker: Offer services', exact: true }).check();
  await page.getByLabel('Email', { exact: true }).fill('person@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Password123!');
  await page.getByRole('checkbox', { name: 'I agree to the Terms and Conditions', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Retry');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('Password123!');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('Password123!');
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain('Password123!');
});

test('restoration failure shows retry rather than a fresh account form', async ({ page }) => {
  await mockAccountJourney(page, { state: 'identity_pending' });
  let fail = true;
  await page.route('**/functions/v1/account-registration', async (route) => route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: corsHeaders })
    : route.fulfill({ status: fail ? 503 : 200, headers: corsHeaders, json: fail ? { error: 'Registration could not be loaded. Retry.' } : { state: 'identity_pending' } }));
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Retry loading registration' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry loading registration' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your identity', exact: true })).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) test('long verification content remains usable with ' + theme + ' theme and enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((value) => localStorage.setItem('trabawho-theme-mode', value), theme);
  await mockAccountJourney(page, { state: 'name_pending', legalName: 'Maria Isabel de la Cruz Santos ' + 'LongLegalName'.repeat(8), documentType: 'passport', sessionId: 'didit-owned' });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Name on your verified ID' })).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 24px !important; }' });
  await expectNoRegistrationOverflow(page);
  await page.getByRole('button', { name: 'Confirm my legal name' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Confirm my legal name' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('registration-' + theme + '-large-text.png'), fullPage: true });
});
