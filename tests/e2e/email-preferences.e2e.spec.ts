import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page) {
  let emailEnabled = true;
  let failSave = false;
  const writes: Record<string, unknown>[] = [];
  await page.route('**/__email-preferences*', (route) => route.fulfill({ contentType: 'text/html', body:
    `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/email-preferences-journey.tsx"></script></body></html>` }));
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (!request.url().includes('/notification_preferences')) { await route.fulfill({ headers, json: [] }); return; }
    if (request.method() === 'GET') { await route.fulfill({ headers, json: [{ email_enabled: emailEnabled, sms_enabled: false }] }); return; }
    const payload = request.postDataJSON() as Record<string, unknown>;
    writes.push(payload);
    if (failSave) { await route.fulfill({ status: 503, headers, json: { message: 'Private backend diagnostic' } }); return; }
    emailEnabled = payload.email_enabled === true;
    await route.fulfill({ status: 201, headers, body: '' });
  });
  return { writes, setFailSave(value: boolean) { failSave = value; } };
}

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`saves and reloads email preferences with keyboard access at ${width}px`, async ({ page }) => {
    const state = await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/__email-preferences');
    const toggle = page.getByRole('switch', { name: 'Email notifications' });
    await expect(toggle).toBeEnabled();
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: 'Save Preferences' }).click();
    await expect(page.getByRole('status')).toContainText('Your preferences have been saved.');
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({ user_id: '11111111-1111-4111-8111-111111111111', email_enabled: false });
    await page.reload();
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    const box = await toggle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('failed saves preserve the draft and retry the same choice', async ({ page }) => {
  const state = await fixture(page);
  state.setFailSave(true);
  await page.goto('/__email-preferences');
  const toggle = page.getByRole('switch', { name: 'Email notifications' });
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await page.getByRole('button', { name: 'Save Preferences' }).click();
  await expect(page.getByRole('status')).toContainText('Notification preferences could not be saved.');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('status')).not.toContainText('Private backend diagnostic');
  state.setFailSave(false);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your preferences have been saved.');
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].email_enabled).toBe(false);
});
