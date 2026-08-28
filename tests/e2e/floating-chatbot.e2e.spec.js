const { test, expect } = require('@playwright/test');
const {
  DEMO_CLIENT_EMAIL,
  DEMO_PASSWORD,
} = require('./helpers/supabase');

function collectConsoleFailures(page, allowedPatterns = []) {
  const failures = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (allowedPatterns.some((pattern) => pattern.test(text))) return;
    failures.push(text);
  });

  page.on('pageerror', (error) => {
    failures.push(error.message);
  });

  return failures;
}

async function expectNoHorizontalOverflow(page) {
  const layoutIssue = await page.evaluate(() => {
    const horizontalOverflow = document.documentElement.scrollWidth - window.innerWidth;
    return horizontalOverflow > 8 ? `Page has horizontal overflow of ${horizontalOverflow}px.` : '';
  });

  expect(layoutIssue).toBe('');
}

async function mockChatbot(page, handler) {
  await page.route('**/functions/v1/trabawho-chatbot', async (route) => {
    const request = route.request();

    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: 'ok',
      });
      return;
    }

    await handler(route);
  });
}

async function loginAsClient(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Login$/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByLabel('Email').fill(DEMO_CLIENT_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.locator('form').getByRole('button', { name: /^Login$/ }).click();
  await expect(page.getByTestId('client-home-dashboard')).toBeVisible({ timeout: 20_000 });
}

test.describe('floating TrabaWho chatbot', () => {
  const viewports = [
    { name: 'desktop', width: 1366, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  test('stays hidden for logged-out users', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');

    await expect(page.getByRole('button', { name: /open trabawho assistant/i })).toHaveCount(0);
    await expect(page.getByTestId('floating-chatbot')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  for (const viewport of viewports) {
    test(`logged-in user opens, sends, renders response, and closes on ${viewport.name}`, async ({ page }) => {
      const consoleFailures = collectConsoleFailures(page);
      let requestBody = null;

      await mockChatbot(page, async (route) => {
        requestBody = route.request().postDataJSON();
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'You can browse services, open a provider profile, then continue into booking when ready.',
            model: 'llama-3.1-8b-instant',
          }),
        });
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAsClient(page);

      const toggle = page.getByRole('button', { name: /open trabawho assistant/i });
      await expect(toggle).toBeVisible();
      await toggle.click();

      await expect(page.getByRole('dialog', { name: /trabawho assistant/i })).toBeVisible();
      await expect(page.getByText(/marketplace and booking help/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /book a provider/i })).toBeVisible();

      await page.getByLabel(/message trabawho assistant/i).fill('How do I book a service?');
      await page.getByRole('button', { name: /^send message$/i }).click();

      await expect(page.getByTestId('chatbot-loading')).toBeVisible();
      await expect(page.getByTestId('chatbot-message-user').filter({ hasText: 'How do I book a service?' })).toBeVisible();
      await expect(page.getByTestId('chatbot-message-assistant').filter({ hasText: /open a provider profile/i })).toBeVisible();

      expect(requestBody.context).toMatchObject({
        currentView: 'client-dashboard',
        isLoggedIn: true,
      });
      expect(requestBody.messages.at(-1)).toMatchObject({
        role: 'user',
        content: 'How do I book a service?',
      });

      await expectNoHorizontalOverflow(page);

      await page.getByRole('button', { name: /close trabawho assistant/i }).first().click();
      await expect(page.getByRole('dialog', { name: /trabawho assistant/i })).toHaveCount(0);

      expect(consoleFailures).toEqual([]);
    });
  }

  test('logged-in user gets a short clarification for accidental input', async ({ page }) => {
    let chatbotCalls = 0;

    await mockChatbot(page, async (route) => {
      chatbotCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'This should not be needed for low-signal input.',
          model: 'llama-3.1-8b-instant',
        }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsClient(page);
    await page.getByRole('button', { name: /open trabawho assistant/i }).click();
    await page.getByLabel(/message trabawho assistant/i).fill('ww');
    await page.getByRole('button', { name: /^send message$/i }).click();

    await expect(page.getByTestId('chatbot-message-user').filter({ hasText: 'ww' })).toBeVisible();
    await expect(page.getByTestId('chatbot-message-assistant').filter({ hasText: /did not catch/i })).toBeVisible();
    await expect(page.getByText(/examples include/i)).toHaveCount(0);
    expect(chatbotCalls).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

  test('logged-in user sees a sanitized error state when the Edge Function fails', async ({ page }) => {
    await mockChatbot(page, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'provider detail should not render' }),
      });
    });

    await page.setViewportSize({ width: 1366, height: 900 });
    await loginAsClient(page);
    await page.getByRole('button', { name: /open trabawho assistant/i }).click();
    await page.getByLabel(/message trabawho assistant/i).fill('Will this fail safely?');
    await page.getByRole('button', { name: /^send message$/i }).click();

    await expect(page.getByRole('alert')).toContainText(/assistant is unavailable/i);
    await expect(page.getByText(/provider detail should not render/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
