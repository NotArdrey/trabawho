const { test, expect } = require('@playwright/test');
const {
  DEMO_ADMIN_EMAIL,
  DEMO_CLIENT_EMAIL,
  DEMO_PASSWORD,
} = require('./helpers/supabase');

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
  const layoutIssue = await page.evaluate(() => {
    const rootElement = document.querySelector('#root');
    if (!rootElement) return 'Missing #root element.';

    const bodyText = document.body.innerText.trim();
    if (bodyText.length < 40) return 'Page rendered too little visible text.';

    const rootRect = rootElement.getBoundingClientRect();
    if (rootRect.width < 320 || rootRect.height < 300) return 'Root layout box is too small.';

    const horizontalOverflow = document.documentElement.scrollWidth - window.innerWidth;
    if (horizontalOverflow > 8) return `Page has horizontal overflow of ${horizontalOverflow}px.`;

    return '';
  });

  expect(layoutIssue).toBe('');
}

async function loginAs(page, email, password = DEMO_PASSWORD) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Sign in$/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('form').getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0, { timeout: 20_000 });
}

test.describe('AI redesign smoke verification', () => {
  const viewports = [
    { name: '390px', width: 390, height: 844 },
    { name: '768px', width: 768, height: 1024 },
    { name: '1024px', width: 1024, height: 900 },
    { name: '1280px', width: 1280, height: 900 },
    { name: '1440px', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    test(`landing page remains usable after redesign on ${viewport.name}`, async ({ page }) => {
      const consoleFailures = collectConsoleFailures(page);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      const root = page.locator('#root');
      await expect(root).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Find trusted local help, right when you need it.' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Sign in$/i }).first()).toBeVisible();
      await expect(page.locator('[aria-label^="Go to slide"]')).toHaveCount(0);

      await expectNoHorizontalOverflow(page);
      expect(consoleFailures).toEqual([]);
    });

    test(`public browse services is reachable and responsive on ${viewport.name}`, async ({ page }) => {
      const consoleFailures = collectConsoleFailures(page);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.getByLabel('What service do you need?').fill('aircon cleaning');
      await page.getByLabel('Location').fill('Malolos');
      await page.getByRole('button', { name: /^Search$/ }).click();

      await expect(page).toHaveURL(/\/services\?q=aircon\+cleaning&location=Malolos$/);
      await expect(page.getByTestId('public-browse-services')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByLabel('Search services and providers')).toHaveValue('aircon cleaning');
      await expect(page.getByPlaceholder('City or province')).toHaveValue('Malolos');
      await expect(page.getByRole('button', { name: /^All$/ })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      expect(consoleFailures).toEqual([]);
    });

    test(`public browse services supports direct hash entry on ${viewport.name}`, async ({ page }) => {
      const consoleFailures = collectConsoleFailures(page);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/#browse-services');

      await expect(page.getByTestId('public-browse-services')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('heading', { name: /Find trusted local help/i })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      expect(consoleFailures).toEqual([]);
    });
  }

  test('public search preserves values across browser navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Cleaning', exact: true }).first().click();
    await expect(page).toHaveURL(/\/services\?q=Cleaning$/);
    await expect(page.getByLabel('Search services and providers')).toHaveValue('Cleaning');

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Find trusted local help, right when you need it.' })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/services\?q=Cleaning$/);
    await expect(page.getByLabel('Search services and providers')).toHaveValue('Cleaning');
  });

  for (const themeCase of [
    { mode: 'light', systemColor: 'dark', expected: 'light' },
    { mode: 'dark', systemColor: 'light', expected: 'dark' },
    { mode: 'system', systemColor: 'dark', expected: 'dark' },
  ]) {
    test(`landing honors ${themeCase.mode} theme preference`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: themeCase.systemColor });
      await page.addInitScript((mode) => {
        window.localStorage.setItem('trabawho-theme-mode', mode);
      }, themeCase.mode);
      await page.goto('/');

      await expect(page.locator('html')).toHaveAttribute('data-theme', themeCase.expected);
      await expect(page.getByRole('heading', { name: 'Find trusted local help, right when you need it.' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test('landing remains usable at a 200% page scale', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });

    await expect(page.getByRole('heading', { name: 'Find trusted local help, right when you need it.' })).toBeVisible();
    await expect(page.getByLabel('What service do you need?')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844, visualVisible: false },
    { name: 'desktop', width: 1440, height: 900, visualVisible: true },
  ]) {
    test(`registration is clear and responsive on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
      await expect(page.getByLabel('Account Type')).toBeVisible();
      const identityDocument = page.getByLabel('Identity document');
      await expect(identityDocument).toBeVisible();
      await identityDocument.click();
      await page.getByRole('option', { name: 'Passport' }).click();
      await expect(identityDocument).toContainText('Passport');
      await expect(page.getByText('80+')).toHaveCount(0);
      if (viewport.visualVisible) {
        await expect(page.locator('.auth-visual')).toBeVisible();
      } else {
        await expect(page.locator('.auth-visual')).toBeHidden();
      }
      await expectNoHorizontalOverflow(page);
    });
  }

  test('authentication mode control uses consistent sign-in language', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('tab', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await page.getByRole('tab', { name: 'Register' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  });

  test('password recovery route is direct, accessible, and validates safely', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/reset-password');

    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('Confirm new password', { exact: true }).fill('different');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Enter at least 8 characters.')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('protected deep links redirect to sign in and retain the destination', async ({ page }) => {
    await page.goto('/bookings?filter=pending');

    await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fbookings%3Ffilter%3Dpending$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('authenticated client can navigate refreshed app surfaces', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);

    await page.setViewportSize({ width: 1366, height: 900 });
    await loginAs(page, DEMO_CLIENT_EMAIL);

    await expect(page.getByTestId('client-home-dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^Browse$/ }).click();
    await expect(page.getByTestId('app-browse-services')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/services$/);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^Bookings$/ }).click();
    await expect(page.getByTestId('my-bookings-page')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/bookings$/);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^My Work$/ }).click();
    await expect(page.getByTestId('my-work-page')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/work$/);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Profile menu').click();
    await page.getByRole('button', { name: /^Profile$/ }).click();
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/profile$/);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Profile menu').click();
    await page.getByRole('button', { name: /^Settings$/ }).click();
    await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/settings\/preferences$/);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Profile menu').click();
    await page.getByRole('button', { name: /^Account & Privacy$/ }).click();
    await expect(page.getByTestId('account-settings-page')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/settings\/account$/);
    await expectNoHorizontalOverflow(page);

    expect(consoleFailures).toEqual([]);
  });

  test('admin demo account can reach admin and return to refreshed app shell', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);

    await page.setViewportSize({ width: 1366, height: 900 });
    await loginAs(page, DEMO_ADMIN_EMAIL);

    await expect(page.getByRole('heading', { name: 'TrabaWho Admin Dashboard' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Back to App' }).click();
    await expect(page.getByTestId('client-home-dashboard')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Browse$/ }).click();
    await expect(page.getByTestId('app-browse-services')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    expect(consoleFailures).toEqual([]);
  });
});
