import { test, expect, type Page } from '@playwright/test';
import { corsHeaders, expectNoRegistrationOverflow, fillManualEvidence, fillRegistration, mockRegistrationLocations, selectRegistrationOption, serviceLocation } from './helpers/registration';

test.beforeEach(async ({ page }) => { await mockRegistrationLocations(page); });

async function mockDidit(page: Page, status: string) {
  const completions: unknown[] = [];
  await page.route('**/functions/v1/create-didit-session', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ headers: corsHeaders, json: body.action === 'get_session'
      ? { success: true, status, businessStatus: status }
      : { success: true, sessionId: 'didit-session-123', sessionNonce: 'nonce-123', verificationUrl: 'https://verification.didit.me/session/demo' } });
  });
  await page.route('**/functions/v1/create-unverified-user', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    completions.push(route.request().postDataJSON() as unknown);
    await route.fulfill({ headers: corsHeaders, json: { success: true, identityStatus: status } });
  });
  return completions;
}

for (const outcome of [
  { status: 'APPROVED', message: 'Your identity was approved. Confirm your email, then log in.' },
  { status: 'PENDING_REVIEW', message: 'Your account was created, but access is held until identity review is approved.' },
]) {
  test(`legacy identity route submits the full address and consents for ${outcome.status}`, async ({ page }) => {
    const completions = await mockDidit(page, outcome.status);
    await page.goto('/#identity-register');
    await fillRegistration(page);
    await page.getByRole('button', { name: 'Start Didit Verification' }).click();
    await expect(page.getByTestId('didit-session-panel')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Didit Verification' })).toHaveAttribute('href', /verification\.didit\.me/);
    await page.reload();
    await page.getByRole('button', { name: 'Check Verification Status' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByText(outcome.message, { exact: true })).toBeVisible();
    expect(completions).toEqual([expect.objectContaining({ ...serviceLocation, acceptedIdentityTerms: true, acceptedRaTerms: true, diditStatus: outcome.status })]);
    await expectNoRegistrationOverflow(page);
  });
}

test('declined verification cannot create an account and preserves registration details for retry', async ({ page }) => {
  const completions = await mockDidit(page, 'DECLINED');
  await page.goto('/#identity-register');
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Start Didit Verification' }).click();
  await page.getByRole('button', { name: 'Check Verification Status' }).click();
  await expect(page.getByTestId('identity-outcome')).toContainText('Verification was not completed');
  expect(completions).toEqual([]);
  await page.getByRole('button', { name: 'Try Again' }).click();
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('person@example.com');
});

test('Postal ID signup from the legacy identity route includes all address fields and image evidence', async ({ page }) => {
  let payload: unknown;
  await page.route('**/functions/v1/manual-identity-review', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    payload = route.request().postDataJSON() as unknown;
    await route.fulfill({ headers: corsHeaders, json: { success: true, message: 'Manual review submitted.' } });
  });
  await page.goto('/#identity-register');
  await fillRegistration(page, 'Postal ID');
  await fillManualEvidence(page);
  await page.getByRole('button', { name: 'Go to previous page' }).click();
  await expect(page.getByLabel('Specific Address')).toHaveValue(serviceLocation.address);
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await page.getByRole('button', { name: 'Submit Manual Review' }).click();
  await expect(page.getByTestId('identity-outcome')).toContainText('Manual review submitted');
  expect(payload).toMatchObject({ ...serviceLocation, action: 'submit_manual_review_signup', documentTypeKey: 'postal_id', acceptedIdentityTerms: true, acceptedRaTerms: true,
    frontImage: { mimeType: 'image/png' }, backImage: { mimeType: 'image/png' }, selfieImage: { mimeType: 'image/png' } });
  await expectNoRegistrationOverflow(page);
});

for (const [document, manual] of [
    ['National ID / ID card', false], ['Passport', false], ["Driver's license", false], ['UMID', true], ['Postal ID', true],
    ["Voter's ID", true], ['PRC ID', true], ['Health insurance ID', true], ['Other government document', true],
  ] as const) {
  test(`${document} uses its correct verification path`, async ({ page }) => {
    await page.goto('/#identity-register');
    await fillRegistration(page, document);
    await expect(page.getByTestId('manual-review-fields')).toHaveCount(manual ? 1 : 0);
    await expect(page.getByRole('button', { name: manual ? 'Submit Manual Review' : 'Start Didit Verification' })).toBeVisible();
  });
}

test('identity route supports mobile direct entry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#identity-register');
  await expect(page.getByRole('heading', { name: 'Create Account', exact: true })).toBeVisible();
  await fillRegistration(page, 'Postal ID');
  await fillManualEvidence(page);
  await expectNoRegistrationOverflow(page);
});

test('existing register link includes client and worker choices on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#register');
  await selectRegistrationOption(page, 'Account Type', 'Worker');
  await expect(page.getByRole('combobox', { name: 'Account Type' })).toContainText('Worker');
  await selectRegistrationOption(page, 'Account Type', 'Client');
  await expect(page.getByRole('combobox', { name: 'Account Type' })).toContainText('Client');
  await expectNoRegistrationOverflow(page);
});
