const { test, expect } = require('@playwright/test');
const {
  DEMO_ADMIN_EMAIL,
  DEMO_CLIENT_EMAIL,
  DEMO_PASSWORD,
  prepareWorkerDemoData,
} = require('./helpers/supabase');

const CASH_KEY = 'trabawho_cash_confirmation_requests';
const REFUND_KEY = 'trabawho_refund_requests';
const BOOKING_DEMO_CLIENT_EMAIL = 'demo.user@giglink.test';

function collectConsoleFailures(page) {
  const failures = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    failures.push(message.text());
  });

  page.on('pageerror', (error) => {
    failures.push(error.message);
  });

  return failures;
}

async function loginAs(page, email, password = DEMO_PASSWORD) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Sign in$/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('form').getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0, { timeout: 20_000 });
}

async function openMyWork(page) {
  await page.getByLabel('My Work').click();
  await expect(page.getByTestId('my-work-page')).toBeVisible();
  await expect(page.getByText(/Loading your seller profile/)).toHaveCount(0, { timeout: 20_000 });
}

async function createService(page, { title, bookingMode = 'with-slots' }) {
  await page.getByLabel('Add service').click();
  const modal = page.getByTestId('create-service-modal');
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder('Title').fill(title);
  await modal.getByPlaceholder('Short description').fill(`Created by Playwright for ${bookingMode}`);
  await modal.getByPlaceholder('Price').fill('650');
  await modal.getByRole('radio', { name: bookingMode === 'with-slots' ? 'Time-slot booking' : 'Request booking' }).click();
  await modal.getByPlaceholder('Duration (min)').fill('90');

  if (bookingMode === 'with-slots') {
    await modal.getByRole('button', { name: 'Add Time' }).first().click();
    await modal.getByLabel('Start').first().fill('09:00');
    await modal.getByLabel('End').first().fill('11:00');
    await modal.getByLabel('Capacity').first().fill('2');
  }

  await modal.getByRole('button', { name: 'Create' }).click();
  await expect(modal).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('p').filter({ hasText: title }).first()).toBeVisible({ timeout: 20_000 });
}

async function expectPrimarySectionsUsable(page) {
  const sectionIds = [
    'work-inquiries-section',
    'work-cash-section',
    'work-refund-section',
    'work-cancelled-section',
    'work-schedule-section',
  ];

  for (const sectionId of sectionIds) {
    const section = page.getByTestId(sectionId);
    await expect(section).toBeVisible();
    await section.scrollIntoViewIfNeeded();
    const issue = await section.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 20) return `${element.dataset.testid} has no usable layout box`;

      const x = Math.min(Math.max(rect.left + rect.width / 2, 1), window.innerWidth - 2);
      const y = Math.min(Math.max(rect.top + 24, 1), window.innerHeight - 2);
      const topElement = document.elementFromPoint(x, y);
      if (topElement && !element.contains(topElement)) {
        return `${element.dataset.testid} is visually occluded by ${topElement.tagName.toLowerCase()}`;
      }

      return '';
    });

    expect(issue).toBe('');
  }
}

test('client demo account logs in through the public login modal', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);

  await loginAs(page, BOOKING_DEMO_CLIENT_EMAIL);
  await expect(page.getByRole('button', { name: 'Client workspace' })).toBeVisible();
  await expect(page.getByText(/Welcome back/i)).toBeVisible();

  expect(consoleFailures).toEqual([]);
});

test('admin demo account logs in and can access the admin dashboard', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);

  await loginAs(page, DEMO_ADMIN_EMAIL);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 20_000 });
  const sidebar = page.getByRole('complementary', { name: /admin navigation sidebar/i });
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Manage account & privacy/i })).toBeEnabled();
  await page.getByRole('radio', { name: /^Dark/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: /^Light/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radio', { name: /^Device/i }).click();
  await page.getByRole('button', { name: /Manage account & privacy/i }).click();
  await expect(page.getByTestId('account-settings-page')).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await sidebar.getByRole('button', { name: /Account Management/i }).click();
  await expect(page.getByRole('heading', { name: 'Account management' })).toBeVisible();
  await expect(page.getByText(/^Showing \d+–\d+ of \d+ accounts$/)).toBeVisible();
  const nextAccountsPage = page.getByRole('button', { name: 'Next' });
  if (await nextAccountsPage.count()) {
    await nextAccountsPage.click();
    await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
  }
  await page.locator('main button:not([disabled])', { hasText: 'Set admin' }).first().click();
  await expect(page.getByRole('heading', { name: 'Grant admin access?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await sidebar.getByRole('button', { name: /Audit Logs/i }).click();
  await expect(page.getByText('Audit feed not available')).toBeVisible();
  await sidebar.getByRole('button', { name: /^Reviews$/i }).click();
  await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search written review comments' })).toBeVisible();
  await page.getByRole('button', { name: 'Unpublished' }).click();
  await expect(page.getByRole('button', { name: 'Unpublished' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await sidebar.getByRole('button', { name: /^Overview$/i }).click();
  for (const width of [390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    if (width >= 881) {
      await expect(sidebar).toBeVisible();
      expect(Math.round((await sidebar.boundingBox()).width)).toBe(248);
      await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeHidden();
    } else {
      await expect(sidebar).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible();
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width + 2);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Back to App' }).click();
  await expect(page.getByTestId('client-home-dashboard')).toBeVisible();

  expect(consoleFailures).toEqual([]);
});

test('My Work loads profile data and manages service slots end to end', async ({ page }) => {
  await prepareWorkerDemoData({ bookingMode: 'with-slots' });
  const consoleFailures = collectConsoleFailures(page);

  await loginAs(page, DEMO_CLIENT_EMAIL);
  await openMyWork(page);

  await expect(page.getByTestId('work-schedule-section')).toBeVisible();
  await expect(page.getByText('Service Availability')).toBeVisible();

  await page.getByLabel('Add service').click();
  await expect(page.getByTestId('create-service-modal')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('create-service-modal')).toHaveCount(0);

  const serviceTitle = `E2E Slot Service ${Date.now()}`;
  await createService(page, { title: serviceTitle, bookingMode: 'with-slots' });

  await page.getByRole('button', { name: /\+ Add Slot/ }).first().click();
  await page.getByLabel('Start Time').fill('09:00');
  await page.getByLabel('End Time').fill('10:30');
  await page.getByLabel('Slot Capacity').fill('2');
  await page.getByRole('button', { name: 'Add Slot' }).click();
  await expect(page.getByText('09:00 - 10:30')).toBeVisible({ timeout: 20_000 });

  await page.getByTitle('Edit slot').first().click();
  await page.getByLabel('Start Time').fill('10:00');
  await page.getByLabel('End Time').fill('11:00');
  await page.getByLabel('Slot Capacity').fill('4');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('10:00 - 11:00')).toBeVisible({ timeout: 20_000 });

  await page.getByTitle('Delete slot').first().click();
  await expect(page.getByRole('heading', { name: 'Confirm Deletion' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('10:00 - 11:00')).toHaveCount(0, { timeout: 20_000 });

  await expectPrimarySectionsUsable(page);
  expect(consoleFailures).toEqual([]);
});

test('My Work supports request-booking services without standalone availability setup', async ({ page }) => {
  await prepareWorkerDemoData({ bookingMode: 'calendar-only' });
  const consoleFailures = collectConsoleFailures(page);

  await loginAs(page, DEMO_CLIENT_EMAIL);
  await openMyWork(page);

  const serviceTitle = `E2E Calendar Service ${Date.now()}`;
  await createService(page, { title: serviceTitle, bookingMode: 'calendar-only' });
  await expect(page.getByText('Booking: Request booking')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('work-schedule-section')).toHaveCount(0);

  expect(consoleFailures).toEqual([]);
});

test('cash decisions and refund approval sync to localStorage', async ({ page }) => {
  await prepareWorkerDemoData({ bookingMode: 'with-slots' });

  await page.addInitScript(({ cashKey, refundKey }) => {
    window.localStorage.setItem(cashKey, JSON.stringify([
      {
        id: 'cash-approve-e2e',
        bookingId: 'cash-approve-booking',
        clientName: 'Cash Approval Client',
        serviceType: 'E2E Cash Service',
        weekOffset: 0,
        expectedCashAmount: 500,
        submittedCashAmount: 500,
        status: 'pending-worker-review',
        cashConfirmationQrId: 'CASH-APPROVE-E2E',
      },
      {
        id: 'cash-deny-e2e',
        bookingId: 'cash-deny-booking',
        clientName: 'Cash Denial Client',
        serviceType: 'E2E Cash Service',
        weekOffset: 0,
        expectedCashAmount: 600,
        submittedCashAmount: 100,
        status: 'pending-worker-review',
        cashConfirmationQrId: 'CASH-DENY-E2E',
      },
    ]));

    window.localStorage.setItem(refundKey, JSON.stringify([
      {
        id: 'refund-approve-e2e',
        bookingId: 'refund-approve-booking',
        clientName: 'Refund Approval Client',
        serviceType: 'E2E Refund Service',
        weekOffset: 0,
        transactionId: 'GCASH-E2E-001',
        status: 'requested',
        refundAmount: 450,
        refundReason: 'Cancelled before service.',
      },
    ]));
  }, { cashKey: CASH_KEY, refundKey: REFUND_KEY });

  const consoleFailures = collectConsoleFailures(page);

  await loginAs(page, DEMO_CLIENT_EMAIL);
  await openMyWork(page);

  await expect(page.getByTestId('cash-confirmation-cash-approve-e2e')).toBeVisible();
  await page.getByTestId('cash-approve-cash-approve-e2e').click();
  await page.getByRole('button', { name: 'Yes, Approve' }).click();
  await page.waitForFunction((key) => {
    const requests = JSON.parse(window.localStorage.getItem(key) || '[]');
    return requests.find((request) => request.id === 'cash-approve-e2e')?.status === 'approved';
  }, CASH_KEY);

  await page.getByTestId('cash-deny-cash-deny-e2e').click();
  await page.getByRole('button', { name: 'Yes, Deny' }).click();
  await page.waitForFunction((key) => {
    const requests = JSON.parse(window.localStorage.getItem(key) || '[]');
    return requests.find((request) => request.id === 'cash-deny-e2e')?.status === 'denied';
  }, CASH_KEY);

  await page.getByTestId('refund-approve-refund-approve-e2e').click();
  await page.waitForFunction((key) => {
    const requests = JSON.parse(window.localStorage.getItem(key) || '[]');
    return requests.find((request) => request.id === 'refund-approve-e2e')?.status === 'approved-awaiting-client-confirmation';
  }, REFUND_KEY);

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('Cash Approval Client')).toBeVisible();
  await expect(page.getByText('Cash Denial Client')).toBeVisible();
  await expect(page.getByText('Awaiting Client Confirmation')).toBeVisible();

  expect(consoleFailures).toEqual([]);
});
