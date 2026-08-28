const { test, expect } = require('@playwright/test');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function collectConsoleFailures(page) {
  const failures = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    failures.push(error.message);
  });

  return failures;
}

async function expectNoHorizontalOverflow(page) {
  const issue = await page.evaluate(() => {
    const bodyText = document.body.innerText.trim();
    if (bodyText.length < 40) return 'Page rendered too little visible text.';

    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    if (overflow > 8) return `Page has horizontal overflow of ${overflow}px.`;

    return '';
  });

  expect(issue).toBe('');
}

async function fulfillJson(route, payload, status = 200) {
  await route.fulfill({
    status,
    headers: corsHeaders,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function readJsonBody(request) {
  try {
    return JSON.parse(request.postData() || '{}');
  } catch {
    return {};
  }
}

async function mockDiditRoutes(page, finalStatus, createUserPayload = {}) {
  await page.route('**/functions/v1/create-didit-session', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const body = readJsonBody(request);
    if (body.action === 'get_session') {
      await fulfillJson(route, {
        success: true,
        sessionId: 'didit-session-123',
        status: finalStatus,
        businessStatus: finalStatus,
        verification_data: { status: finalStatus },
      });
      return;
    }

    await fulfillJson(route, {
      success: true,
      sessionId: 'didit-session-123',
      sessionNonce: 'nonce-123',
      workflowId: '53ea504a-5de7-4ed3-b402-0f0604be5b87',
      verificationUrl: 'https://verification.didit.me/session/demo',
    });
  });

  await page.route('**/functions/v1/create-unverified-user', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await fulfillJson(route, {
      success: true,
      userId: '00000000-0000-4000-8000-000000000053',
      identityStatus: finalStatus === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'APPROVED',
      emailConfirmationRequired: finalStatus === 'APPROVED',
      emailConfirmationDeferred: finalStatus !== 'APPROVED',
      ...createUserPayload,
    });
  });
}

async function fillDiditSignup(page, email = 'verified-user@example.com') {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm password').fill('Password123!');
  await page.getByLabel(/I consent to TrabaWho/i).check();
  await page.getByRole('button', { name: /Start Didit Verification/i }).click();
}

test.describe('identity-first registration', () => {
  test('Didit approval creates an unconfirmed account and asks for email confirmation', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await mockDiditRoutes(page, 'APPROVED');

    await page.goto('/#identity-register');
    await expect(page.getByTestId('identity-registration-page')).toBeVisible();
    await fillDiditSignup(page);

    await expect(page.getByTestId('didit-session-panel')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Didit Verification/i })).toHaveAttribute('href', /verification\.didit\.me/);

    await page.getByRole('button', { name: /Check Verification Status/i }).click();
    await expect(page.getByTestId('identity-outcome')).toContainText('Email confirmation sent');
    await expect(page.getByTestId('identity-outcome')).toContainText('confirm your email before logging in');

    await expectNoHorizontalOverflow(page);
    expect(consoleFailures).toEqual([]);
  });

  test('Didit pending review creates a gated account without sending login access', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await mockDiditRoutes(page, 'PENDING_REVIEW');

    await page.goto('/#identity-register');
    await fillDiditSignup(page, 'pending-review@example.com');
    await page.getByRole('button', { name: /Check Verification Status/i }).click();

    await expect(page.getByTestId('identity-outcome')).toContainText('Identity review pending');
    await expect(page.getByTestId('identity-outcome')).toContainText('access is held until identity review is approved');

    await expectNoHorizontalOverflow(page);
    expect(consoleFailures).toEqual([]);
  });

  test('Didit terminal failure returns the user to retry registration', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await mockDiditRoutes(page, 'DECLINED');

    await page.goto('/#identity-register');
    await fillDiditSignup(page, 'declined-user@example.com');
    await page.getByRole('button', { name: /Check Verification Status/i }).click();

    await expect(page.getByTestId('identity-outcome')).toContainText('Verification was not completed');
    await page.getByRole('button', { name: /Try Again/i }).click();
    await expect(page.getByRole('button', { name: /Start Didit Verification/i })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(consoleFailures).toEqual([]);
  });

  test('manual document review submits unsupported IDs to the review queue', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    let manualPayload = null;

    await page.route('**/functions/v1/manual-identity-review', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      manualPayload = readJsonBody(request);
      await fulfillJson(route, {
        success: true,
        userId: '00000000-0000-4000-8000-000000000054',
        manualReviewId: 'manual-review-123',
        identityStatus: 'PENDING_REVIEW',
        message: 'Manual review submitted.',
      });
    });

    await page.goto('/#identity-register');
    await page.getByLabel('Identity document').selectOption('umid');
    await expect(page.getByTestId('manual-review-fields')).toBeVisible();

    await page.getByLabel('Email').fill('manual-user@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByLabel('Confirm password').fill('Password123!');
    await page.getByLabel('Name on ID').fill('Manual User');
    await page.getByLabel('ID number').fill('UMID-1234567');
    await page.getByLabel('ID expiry date').fill('2030-05-13');
    await page.locator('#manual-front-image').setInputFiles({
      name: 'front.png',
      mimeType: 'image/png',
      buffer: Buffer.from('front-image'),
    });
    await page.locator('#manual-back-image').setInputFiles({
      name: 'back.png',
      mimeType: 'image/png',
      buffer: Buffer.from('back-image'),
    });
    await page.locator('#manual-selfie-image').setInputFiles({
      name: 'selfie.png',
      mimeType: 'image/png',
      buffer: Buffer.from('selfie-image'),
    });
    await page.getByLabel(/I consent to TrabaWho/i).check();
    await page.getByRole('button', { name: /Submit Manual Review/i }).click();

    await expect(page.getByTestId('identity-outcome')).toContainText('Manual review submitted');
    expect(manualPayload).toMatchObject({
      action: 'submit_manual_review_signup',
      email: 'manual-user@example.com',
      documentTypeKey: 'umid',
      identityDocumentNumber: 'UMID-1234567',
    });

    await expectNoHorizontalOverflow(page);
    expect(consoleFailures).toEqual([]);
  });

  test('all ID document options route to the correct verification path', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);

    await page.goto('/#identity-register');
    await expect(page.getByTestId('identity-registration-page')).toBeVisible();

    const expectedModes = {
      id_card: 'didit',
      passport: 'didit',
      drivers_license: 'didit',
      umid: 'manual_review',
      postal_id: 'manual_review',
      voter_id: 'manual_review',
      prc_id: 'manual_review',
      health_insurance: 'manual_review',
      custom_document: 'manual_review',
    };

    const options = await page.getByLabel('Identity document').locator('option').evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.value, label: node.textContent.trim() }))
    );

    expect(options.map((option) => option.value)).toEqual(Object.keys(expectedModes));

    for (const option of options) {
      await page.getByLabel('Identity document').selectOption(option.value);
      const manualVisible = await page.getByTestId('manual-review-fields').isVisible().catch(() => false);
      const actualMode = manualVisible ? 'manual_review' : 'didit';
      expect(actualMode, `${option.label} should use ${expectedModes[option.value]}`).toBe(expectedModes[option.value]);

      const actionLabel = actualMode === 'manual_review' ? /Submit Manual Review/i : /Start Didit Verification/i;
      await expect(page.getByRole('button', { name: actionLabel })).toBeVisible();
    }

    await expectNoHorizontalOverflow(page);
    expect(consoleFailures).toEqual([]);
  });

  test('identity route is responsive on mobile direct entry', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#identity-register');

    await expect(page.getByTestId('identity-registration-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Create a verified account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Didit Verification/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(consoleFailures).toEqual([]);
  });

  test('existing register route includes identity controls on mobile', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#register');

    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    await expect(page.getByLabel('First Name')).toHaveCount(0);
    await expect(page.getByLabel('Middle Name')).toHaveCount(0);
    await expect(page.getByLabel('Last Name')).toHaveCount(0);
    await expect(page.getByLabel('Account Type')).toBeVisible();
    await expect(page.getByLabel('Identity document')).toBeVisible();
    await expect(page.getByLabel('Account Type')).toContainText(/Client/);
    await expect(page.getByLabel('Account Type')).toContainText(/Worker/);
    await expect(page.getByLabel('Account Type')).not.toContainText(/fan|musician/i);
    await expect(page.getByRole('button', { name: /Start Didit Verification/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(consoleFailures).toEqual([]);
  });
});
