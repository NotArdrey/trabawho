import { test, expect, type Page } from '@playwright/test';

const location = { province: 'La Union', city: 'Balaoan', barangay: 'Almeida', address: '12 Main Street' };
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

test.beforeEach(async ({ page }) => {
  await page.route('https://psgc.gitlab.io/api/**', async (route) => {
    const url = route.request().url();
    const data = url.endsWith('/provinces/') ? [{ code: '010000000', name: 'La Union' }, { code: '020000000', name: 'Abra' }]
      : url.endsWith('/cities-municipalities/') ? [{ code: '010010000', name: 'Balaoan' }]
      : [{ code: '010010001', name: 'Almeida' }];
    await route.fulfill({ json: data });
  });
});

async function select(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function security(page: Page, manual = false) {
  await page.goto('/register');
  if (manual) await select(page, 'Identity document', 'UMID');
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await page.getByLabel('Email', { exact: true }).fill('person@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm Password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Go to next page' }).click();
}
async function fillLocation(page: Page) {
  await select(page, 'Province', location.province);
  await select(page, 'City/Municipality', location.city);
  await select(page, 'Barangay', location.barangay);
  await page.getByLabel('Specific Address').fill(location.address);
  await page.getByRole('button', { name: 'Go to next page' }).click();
}
async function consent(page: Page) {
  await page.getByRole('checkbox', { name: /I consent to identity verification/ }).check();
  await page.getByRole('checkbox', { name: 'I agree to the Terms and Conditions', exact: true }).check();
}

test('Next and Enter validate security fields before advancing', async ({ page }) => {
  let requests = 0;
  await page.route('**/functions/v1/**', async (route) => { requests++; await route.abort(); });
  await page.goto('/register');
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await page.getByLabel('Email', { exact: true }).fill('fafaf');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm Password', { exact: true }).fill('other');
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter at least 8 characters.', { exact: true })).toBeVisible();
  await expect(page.getByText('Passwords must match.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await page.getByLabel('Email', { exact: true }).fill('person@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm Password', { exact: true }).press('Enter');
  await expect(page.getByRole('combobox', { name: 'Province', exact: true })).toBeVisible();
  expect(requests).toBe(0);
});

test('location fields validate individually and survive previous navigation', async ({ page }) => {
  await security(page);
  await page.getByRole('button', { name: 'Go to next page' }).click();
  for (const message of ['Select a province.', 'Select a city or municipality.', 'Select a barangay.', 'Enter your house number, street, or specific address.']) {
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  }
  await fillLocation(page);
  await expect(page.getByRole('heading', { name: 'Review and consent' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to previous page' }).click();
  await expect(page.getByRole('combobox', { name: 'Province', exact: true })).toContainText('La Union');
  await expect(page.getByRole('combobox', { name: 'Barangay', exact: true })).toContainText('Almeida');
  await expect(page.getByLabel('Specific Address')).toHaveValue(location.address);
  await select(page, 'Province', 'Abra');
  await expect(page.getByRole('combobox', { name: 'City/Municipality', exact: true })).not.toContainText('Balaoan');
  await expect(page.getByRole('combobox', { name: 'Barangay', exact: true })).not.toContainText('Almeida');
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await expect(page.getByText('Select a city or municipality.', { exact: true })).toBeVisible();
});

test('terms modal supports keyboard close and does not grant consent automatically', async ({ page }) => {
  await security(page);
  await fillLocation(page);
  await page.getByRole('button', { name: 'Start Didit Verification' }).click();
  await expect(page.getByText('Consent to identity verification to continue.')).toBeVisible();
  await expect(page.getByText('Agree to the Terms and Conditions to continue.')).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Terms and Conditions', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Terms and Conditions' });
  await expect(dialog).toContainText('Republic Act No. 10173');
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('checkbox', { name: 'I agree to the Terms and Conditions', exact: true })).not.toBeChecked();
});

test('manual review validates details and uploads, then submits the full address', async ({ page }) => {
  let payload: Record<string, unknown> | null = null;
  await page.route('**/functions/v1/manual-identity-review', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    payload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ headers: corsHeaders, json: { success: true, message: 'Manual review submitted.' } });
  });
  await security(page, true);
  await fillLocation(page);
  await consent(page);
  await page.getByRole('button', { name: 'Submit Manual Review' }).click();
  await expect(page.getByText('Enter the full name shown on your ID.')).toBeVisible();
  await expect(page.getByText('Upload your front ID image.')).toBeVisible();
  expect(payload).toBeNull();
  await page.getByLabel('Name on ID', { exact: true }).fill('Juan Dela Cruz');
  await page.getByLabel('ID number', { exact: true }).fill('UMID-12345');
  await page.getByLabel('ID expiry date').fill('2000-01-01');
  await expect(page.getByText('Use an ID that has not expired.')).toBeVisible();
  await page.getByLabel('ID expiry date').fill('2099-12-31');
  await page.locator('#manual-front-image').setInputFiles({ name: 'front.txt', mimeType: 'text/plain', buffer: Buffer.from('text') });
  await expect(page.getByText('Choose a JPEG, PNG, or WebP image.')).toBeVisible();
  for (const part of ['front', 'back', 'selfie']) {
    await page.locator(`#manual-${part}-image`).setInputFiles({ name: `${part}.png`, mimeType: 'image/png', buffer: Buffer.from('image') });
  }
  await page.getByRole('button', { name: 'Go to previous page' }).click();
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await expect(page.getByRole('button', { name: 'Front image', exact: true })).toContainText('front.png');
  await page.getByRole('button', { name: 'Submit Manual Review' }).click();
  await expect(page.getByTestId('identity-outcome')).toContainText('Manual review submitted');
  expect(payload).toMatchObject({ ...location, identityDocumentNumber: 'UMID-12345', documentTypeKey: 'umid' });
});

test('failed location lookup can be retried without losing account details', async ({ page }) => {
  let fail = true;
  await page.route('https://psgc.gitlab.io/api/provinces/', async (route) => {
    if (fail) await route.fulfill({ status: 503, json: {} });
    else await route.fulfill({ json: [{ code: '010000000', name: 'La Union' }] });
  });
  await security(page);
  await expect(page.getByText('Could not load locations. Check your connection and try again.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await fillLocation(page);
  await expect(page.getByRole('heading', { name: 'Review and consent' })).toBeVisible();
});

test('Didit completion restores and submits the full service location', async ({ page }) => {
  let payload: Record<string, unknown> | null = null;
  await page.route('**/functions/v1/create-didit-session', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ headers: corsHeaders, json: body.action === 'get_session' ? { success: true, status: 'APPROVED' } : { success: true, sessionId: 'session-demo', sessionNonce: 'nonce-demo', verificationUrl: 'https://verification.didit.me/demo' } });
  });
  await page.route('**/functions/v1/create-unverified-user', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    payload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ headers: corsHeaders, json: { success: true, identityStatus: 'APPROVED' } });
  });
  await security(page);
  await fillLocation(page);
  await consent(page);
  await page.getByRole('button', { name: 'Start Didit Verification' }).click();
  await expect(page.getByTestId('didit-session-panel')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Check Verification Status' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect(payload).toMatchObject(location);
});

for (const outcome of [
  { decision: 'APPROVED', identityStatus: 'APPROVED', message: 'Your identity was approved. Confirm your email, then log in.' },
  { decision: 'PENDING_REVIEW', identityStatus: 'PENDING_REVIEW', message: 'Your account was created, but access is held until identity review is approved.' },
  { decision: 'APPROVED', identityStatus: 'PENDING_REVIEW', message: 'Your account was created, but access is held until identity review is approved.' },
] as const) {
  test(`Didit return handles ${outcome.decision} with account status ${outcome.identityStatus}`, async ({ page }) => {
    let completions = 0;
    await page.route('**/functions/v1/create-didit-session', async (route) => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ headers: corsHeaders, json: body.action === 'get_session'
        ? { success: true, status: outcome.decision, businessStatus: outcome.decision, diditResolvedStatus: null, rawDiditStatus: null, verification_data: { status: outcome.decision } }
        : { success: true, sessionId: 'return-session', sessionNonce: 'return-nonce', workflowId: null, verificationUrl: 'https://verification.didit.me/demo' } });
    });
    await page.route('**/functions/v1/create-unverified-user', async (route) => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
      completions++;
      expect(route.request().postDataJSON()).toMatchObject({ ...location, diditStatus: outcome.decision });
      await route.fulfill({ headers: corsHeaders, json: { success: true, identityStatus: outcome.identityStatus } });
    });
    await security(page);
    await fillLocation(page);
    await consent(page);
    await page.getByRole('button', { name: 'Start Didit Verification' }).click();
    await expect(page.getByTestId('didit-session-panel')).toBeVisible();
    await page.goto('/?check_verification=true#login');
    await expect(page.getByText(outcome.message, { exact: true })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('person@example.com');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    expect(completions).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem('trabawho.identitySignup.v1'))).toBeNull();
  });
}

test('a declined Didit return does not create an account', async ({ page }) => {
  let completions = 0;
  await page.route('**/functions/v1/create-didit-session', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ headers: corsHeaders, json: body.action === 'get_session'
      ? { success: true, status: 'DECLINED', diditResolvedStatus: null, rawDiditStatus: null }
      : { success: true, sessionId: 'declined-session', sessionNonce: 'declined-nonce', verificationUrl: 'https://verification.didit.me/demo' } });
  });
  await page.route('**/functions/v1/create-unverified-user', async (route) => { completions++; await route.abort(); });
  await security(page);
  await fillLocation(page);
  await consent(page);
  await page.getByRole('button', { name: 'Start Didit Verification' }).click();
  await expect(page.getByTestId('didit-session-panel')).toBeVisible();
  await page.goto('/?check_verification=true#login');
  await expect(page.getByText('Didit did not approve this attempt. Please start registration again with a valid document.')).toBeVisible();
  expect(completions).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem('trabawho.identitySignup.v1'))).toBeNull();
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`registration fields and terms fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await security(page, true);
    await fillLocation(page);
    await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const input = page.getByLabel('Name on ID', { exact: true });
    const layout = await input.evaluate((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const icon = node.parentElement?.querySelector('svg')?.getBoundingClientRect();
      return { height: rect.height, top: style.paddingTop, bottom: style.paddingBottom, lineHeight: style.lineHeight, iconOffset: icon ? Math.abs(icon.y + icon.height / 2 - rect.y - rect.height / 2) : 99 };
    });
    expect(layout.height).toBe(48);
    expect(layout.top).toBe(layout.bottom);
    expect(layout.lineHeight).toBe('24px');
    expect(layout.iconOffset).toBeLessThan(1);
    await page.getByRole('button', { name: 'Terms and Conditions', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
