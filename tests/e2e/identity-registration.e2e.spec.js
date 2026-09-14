const { test, expect } = require('@playwright/test');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const locationFixtures = {
  provinces: [{ code: '0300000000', name: 'Bulacan' }],
  cities: [{ code: '0314100000', name: 'Meycauayan City' }],
  barangays: [{ code: '0314100001', name: 'Bagbaguin' }],
};

function collectConsoleFailures(page) {
  const failures = [];
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  page.on('pageerror', (error) => failures.push(error.message));
  return failures;
}

async function expectNoHorizontalOverflow(page) {
  const issue = await page.evaluate(() => {
    if (document.body.innerText.trim().length < 40) return 'Page rendered too little visible text.';
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    return overflow > 8 ? `Page has horizontal overflow of ${overflow}px.` : '';
  });
  expect(issue).toBe('');
}

async function fulfillJson(route, payload, status = 200) {
  await route.fulfill({ status, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify(payload) });
}

function readJsonBody(request) {
  try {
    return JSON.parse(request.postData() || '{}');
  } catch {
    return {};
  }
}

async function mockLocationRoutes(page) {
  await page.route('https://psgc.gitlab.io/api/provinces/', (route) => fulfillJson(route, locationFixtures.provinces));
  await page.route('https://psgc.gitlab.io/api/provinces/*/cities-municipalities/', (route) => fulfillJson(route, locationFixtures.cities));
  await page.route('https://psgc.gitlab.io/api/cities-municipalities/*/barangays/', (route) => fulfillJson(route, locationFixtures.barangays));
}

async function mockDiditRoutes(page, finalStatus, capture = {}) {
  await page.route('**/functions/v1/create-didit-session', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const body = readJsonBody(request);
    if (body.action === 'get_session') {
      await fulfillJson(route, { success: true, sessionId: 'didit-session-123', status: finalStatus, businessStatus: finalStatus, verification_data: { status: finalStatus } });
      return;
    }
    capture.createSessionPayload = body;
    await fulfillJson(route, { success: true, sessionId: 'didit-session-123', sessionNonce: 'nonce-123', workflowId: '53ea504a-5de7-4ed3-b402-0f0604be5b87', verificationUrl: 'https://verification.didit.me/session/demo' });
  });

  await page.route('**/functions/v1/create-unverified-user', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    capture.createUserPayload = readJsonBody(request);
    await fulfillJson(route, {
      success: true,
      userId: '00000000-0000-4000-8000-000000000053',
      identityStatus: finalStatus === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'APPROVED',
      emailConfirmationRequired: finalStatus === 'APPROVED',
      emailConfirmationDeferred: finalStatus !== 'APPROVED',
      message: finalStatus === 'APPROVED' ? 'Identity approved. Confirm your email before logging in.' : 'Your account was created and is waiting for identity review.',
    });
  });
}

async function chooseSelectOption(page, label, optionName) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function completeRegistrationForm(page, options = {}) {
  const { accountType = 'Client', document = 'National ID / ID card', email = 'verified-user@example.com' } = options;

  await page.getByRole('radio', { name: new RegExp(accountType) }).check();
  await chooseSelectOption(page, 'Identity document', document);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Next' }).click();
  await chooseSelectOption(page, 'Province', 'Bulacan');
  await chooseSelectOption(page, 'City or municipality', 'Meycauayan City');
  await chooseSelectOption(page, 'Barangay', 'Bagbaguin');
  await page.getByLabel('Specific address').fill('12 Mabini Street');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel(/Identity verification consent/i).check();
  await page.getByLabel(/RA 10173 Terms and Conditions/i).check();
}

test.describe('canonical registration and identity verification', () => {
  test.beforeEach(async ({ page }) => {
    await mockLocationRoutes(page);
  });

  test('validates each registration step before advancing', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Choose Client or Worker.')).toBeVisible();
    await expect(page.getByText('Choose an identity document.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose your account' })).toBeVisible();

    await page.getByRole('radio', { name: /Client/ }).check();
    await chooseSelectOption(page, 'Identity document', 'Passport');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Email', { exact: true }).fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).fill('password');
    await page.getByLabel('Confirm password', { exact: true }).fill('different');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Include at least one uppercase letter and one number.')).toBeVisible();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  test('Didit approval preserves account, location, and consent data through account creation', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    const capture = {};
    await mockDiditRoutes(page, 'APPROVED', capture);
    await page.goto('/register');
    await completeRegistrationForm(page, { accountType: 'Worker' });

    await expect(page.getByText('Worker', { exact: true })).toBeVisible();
    await expect(page.getByText(/Bagbaguin, Meycauayan City, Bulacan/)).toBeVisible();
    await expect(page.getByText(/Didit powers the automatic verification/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Didit verification privacy notice/i })).toHaveAttribute('href', 'https://didit.me/terms/verification-privacy-notice/');
    await expect(page.getByRole('link', { name: /Didit end-user terms/i })).toHaveAttribute('href', 'https://didit.me/terms/identity-verification/');
    await page.getByRole('button', { name: /Start Didit verification/i }).click();
    await expect(page.getByTestId('didit-session-panel')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Didit verification/i })).toHaveAttribute('href', /verification\.didit\.me/);
    expect(capture.createSessionPayload).toMatchObject({
      app_role: 'worker',
      document_type: 'id_card',
      service_location: { province: 'Bulacan', city_municipality: 'Meycauayan City', barangay: 'Bagbaguin', specific_address: '12 Mabini Street' },
      consent: { identity_verification_consent: true, data_privacy_consent: true },
    });

    await page.getByRole('button', { name: /Check verification status/i }).click();
    await expect(page.getByTestId('identity-outcome')).toContainText('Identity approved');
    await expect(page.getByTestId('identity-outcome')).toContainText('Confirm your email');
    expect(capture.createUserPayload).toMatchObject({
      appRole: 'worker',
      verificationMode: 'didit',
      serviceLocation: { province: 'Bulacan', cityMunicipality: 'Meycauayan City', barangay: 'Bagbaguin', specificAddress: '12 Mabini Street' },
    });
    await expectNoHorizontalOverflow(page);
    expect(consoleFailures).toEqual([]);
  });

  test('Didit pending and declined results remain gated and recoverable', async ({ page }) => {
    await mockDiditRoutes(page, 'PENDING_REVIEW');
    await page.goto('/register');
    await completeRegistrationForm(page, { email: 'pending-review@example.com' });
    await page.getByRole('button', { name: /Start Didit verification/i }).click();
    await page.getByRole('button', { name: /Check verification status/i }).click();
    await expect(page.getByTestId('identity-outcome')).toContainText('Identity review pending');
    await expect(page.getByTestId('identity-outcome')).toContainText('waiting for identity review');

    await page.evaluate(() => sessionStorage.clear());
    await page.unroute('**/functions/v1/create-didit-session');
    await page.unroute('**/functions/v1/create-unverified-user');
    await mockDiditRoutes(page, 'DECLINED');
    await page.goto('/register');
    await completeRegistrationForm(page, { email: 'declined-user@example.com' });
    await page.getByRole('button', { name: /Start Didit verification/i }).click();
    await page.getByRole('button', { name: /Check verification status/i }).click();
    await expect(page.getByTestId('identity-outcome')).toContainText('Verification was not completed');
    await page.getByRole('button', { name: /Try another verification method/i }).click();
    await expect(page.getByRole('heading', { name: 'Choose your account' })).toBeVisible();
  });

  test('Didit resubmission keeps the hosted session available', async ({ page }) => {
    await mockDiditRoutes(page, 'Resubmitted');
    await page.goto('/register');
    await completeRegistrationForm(page, { email: 'resubmit-user@example.com' });
    await page.getByRole('button', { name: /Start Didit verification/i }).click();
    await page.getByRole('button', { name: /Check verification status/i }).click();

    await expect(page.getByTestId('didit-session-panel')).toBeVisible();
    await expect(page.getByText(/Didit needs new information/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Didit verification/i })).toBeVisible();
  });

  test('manual document path asks for evidence only after review and consent', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    let manualPayload = null;
    await page.route('**/functions/v1/manual-identity-review', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      manualPayload = readJsonBody(request);
      await fulfillJson(route, { success: true, userId: '00000000-0000-4000-8000-000000000054', manualReviewId: 'manual-review-123', identityStatus: 'PENDING_REVIEW', message: 'Manual review submitted. Email confirmation will be sent after identity approval.' });
    });

    await page.goto('/register');
    await completeRegistrationForm(page, { document: 'UMID', email: 'manual-user@example.com' });
    await expect(page.getByTestId('manual-review-fields')).toHaveCount(0);
    await page.getByRole('button', { name: /Continue to manual verification/i }).click();
    await expect(page.getByTestId('manual-review-fields')).toBeVisible();
    await page.getByLabel('Name on ID').fill('Manual User');
    await page.getByLabel('ID number').fill('UMID-1234567');
    await page.getByLabel('ID expiry date').fill('2030-05-13');
    await page.locator('#frontImage').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: Buffer.from('front-image') });
    await page.locator('#backImage').setInputFiles({ name: 'back.png', mimeType: 'image/png', buffer: Buffer.from('back-image') });
    await page.locator('#selfieImage').setInputFiles({ name: 'selfie.png', mimeType: 'image/png', buffer: Buffer.from('selfie-image') });
    await page.getByRole('button', { name: /Submit manual review/i }).click();

    await expect(page.getByTestId('identity-outcome')).toContainText('Manual review submitted');
    expect(manualPayload).toMatchObject({
      action: 'submit_manual_review_signup',
      email: 'manual-user@example.com',
      appRole: 'client',
      documentTypeKey: 'umid',
      identityDocumentNumber: 'UMID-1234567',
      serviceLocation: { province: 'Bulacan', cityMunicipality: 'Meycauayan City', barangay: 'Bagbaguin', specificAddress: '12 Mabini Street' },
      consent: { identityVerificationConsent: true, dataPrivacyConsent: true },
    });
    await expectNoHorizontalOverflow(page);
    expect(consoleFailures).toEqual([]);
  });

  test('all registration entry points use the canonical responsive flow', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/register', '/#register', '/#identity-register']) {
      await page.goto(path);
      await expect(page.getByTestId('registration-page')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Choose your account' })).toBeVisible();
      await expect(page.getByRole('radio', { name: /Client/ })).toBeVisible();
      await expect(page.getByRole('radio', { name: /Worker/ })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    expect(consoleFailures).toEqual([]);
  });
});
