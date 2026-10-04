import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/__account-workspaces*', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/account-workspaces-journey.tsx"></script></body></html>` }));
  await page.route('**/src/components/notifications/use-realtime-notifications.ts*', route => route.fulfill({ contentType: 'application/javascript', body:
    "export function useRealtimeNotifications() { return { notifications: [], isLoading: false, error: '', actionError: '', markRead() {}, markAllRead() {}, retry() {} }; }" }));
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  for (const role of ['client', 'worker'] as const) {
    test(`separate ${role} account stays in its role at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        localStorage.setItem('trabawho-worker-workspace:worker-account', 'client');
        localStorage.setItem('trabawho-worker-workspace:client-account', 'provider');
      });
      const accountRequests: string[] = [];
      page.on('request', request => {
        if (/\/(auth|functions)\/v1\//.test(request.url())) accountRequests.push(request.url());
      });
      await page.goto('/__account-workspaces?role=' + role);
      await expect(page.getByTestId('account-id')).toHaveText(role + '-account');
      await expect(page.getByTestId('account-role')).toHaveText(role);
      const navigation = page.getByRole('navigation', { name: width < 881 ? 'Mobile dashboard navigation' : 'Dashboard navigation', exact: true });
      const tab = role === 'worker' ? 'My Work' : 'Browse';
      await expect(navigation.getByRole('button', { name: width < 881 ? tab + ' tab' : tab, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Switch to (client|provider) workspace/ })).toHaveCount(0);
      if (width < 881) await page.getByRole('button', { name: 'Profile menu', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: /Switch to (client|provider) workspace|Offer services/ })).toHaveCount(0);
      if (width < 881) await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Other role route', exact: true }).click();
      await expect(page).toHaveURL(role === 'worker' ? /\/worker\/dashboard$/ : /\/dashboard$/);
      await page.getByRole('button', { name: 'Other role action', exact: true }).click();
      await expect(page.getByTestId('current-route')).toHaveText(role === 'worker' ? '/worker/dashboard' : '/dashboard');
      await expect(page.getByTestId('account-id')).toHaveText(role + '-account');
      expect(accountRequests).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 390 || width === 1440) await page.screenshot({ path: test.info().outputPath(role + '-account-' + width + '.png'), fullPage: true });
    });
  }
}
