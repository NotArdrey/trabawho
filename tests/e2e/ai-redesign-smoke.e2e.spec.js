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
  await page.getByRole('button', { name: /^Login$/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('form').getByRole('button', { name: /^Login$/ }).click();
  await expect(page.getByRole('heading', { name: 'Login' })).toHaveCount(0, { timeout: 20_000 });
}

test.describe('AI redesign smoke verification', () => {
  const viewports = [
    { name: 'desktop', width: 1366, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    test(`landing page remains usable after redesign on ${viewport.name}`, async ({ page }) => {
      const consoleFailures = collectConsoleFailures(page);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      const root = page.locator('#root');
      await expect(root).toBeVisible();
      await expect(page.getByRole('button', { name: /login/i }).first()).toBeVisible();

      await expectNoHorizontalOverflow(page);
      expect(consoleFailures).toEqual([]);
    });

    test(`public browse services is reachable and responsive on ${viewport.name}`, async ({ page }) => {
      const consoleFailures = collectConsoleFailures(page);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.getByRole('button', { name: /browse services/i }).first().click();

      await expect(page).toHaveURL(/#browse-services$/);
      await expect(page.getByTestId('public-browse-services')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByPlaceholder(/search services/i)).toBeVisible();
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

  test('authenticated client can navigate refreshed app surfaces', async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);

    await page.setViewportSize({ width: 1366, height: 900 });
    await loginAs(page, DEMO_CLIENT_EMAIL);

    await expect(page.getByTestId('client-home-dashboard')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^Browse$/ }).click();
    await expect(page.getByTestId('app-browse-services')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^Bookings$/ }).click();
    await expect(page.getByTestId('my-bookings-page')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^My Work$/ }).click();
    await expect(page.getByTestId('my-work-page')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Profile menu').click();
    await page.getByRole('button', { name: /^Profile$/ }).click();
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Profile menu').click();
    await page.getByRole('button', { name: /^Settings$/ }).click();
    await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Profile menu').click();
    await page.getByRole('button', { name: /^Account & Privacy$/ }).click();
    await expect(page.getByTestId('account-settings-page')).toBeVisible({ timeout: 20_000 });
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
