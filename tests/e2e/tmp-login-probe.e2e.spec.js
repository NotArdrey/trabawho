const { test } = require('@playwright/test');

test('temporary login probe', async ({ page }) => {
  const events = [];

  page.on('console', (message) => {
    events.push({ type: 'console', level: message.type(), text: message.text().slice(0, 300) });
  });
  page.on('pageerror', (error) => {
    events.push({ type: 'pageerror', text: error.message.slice(0, 300) });
  });
  page.on('requestfailed', (request) => {
    events.push({
      type: 'requestfailed',
      url: request.url().replace(/https:\/\/[^/]+/, 'https://<host>'),
      failure: request.failure()?.errorText,
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      events.push({
        type: 'response',
        status: response.status(),
        url: response.url().replace(/https:\/\/[^/]+/, 'https://<host>'),
      });
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: /^Login$/ }).first().click();
  await page.getByLabel('Email').fill('demo.user@trabawho.test');
  await page.getByLabel('Password').fill('pass123');
  await page.locator('form').getByRole('button', { name: /^Login$/ }).click();
  await page.waitForTimeout(12000);

  const body = await page.locator('body').innerText();
  console.log(JSON.stringify({
    url: page.url(),
    headingLoginCount: await page.getByRole('heading', { name: 'Login' }).count(),
    bodyExcerpt: body.slice(0, 1000),
    events,
  }, null, 2));
});
