import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/__account-workspaces*', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/account-workspaces-journey.tsx"></script></body></html>` }));
  await page.route('**/src/components/notifications/use-realtime-notifications.ts*', route => route.fulfill({ contentType: 'application/javascript', body:
    "export function useRealtimeNotifications() { return { notifications: [], isLoading: false, error: '', actionError: '', markRead() {}, markAllRead() {}, retry() {} }; }" }));
});

async function useAccountAction(page: Page, width: number, name: string) {
  if (width < 881) {
    await page.getByRole('button', { name: 'Profile menu', exact: true }).click();
    await page.getByRole('menuitem', { name, exact: true }).click();
  } else await page.getByRole('button', { name, exact: true }).click();
}

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`one worker account switches between booking and offering at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const accountRequests: string[] = [];
    page.on('request', request => {
      if (/\/(auth|functions)\/v1\//.test(request.url())) accountRequests.push(request.url());
    });
    await page.goto('/__account-workspaces');
    await useAccountAction(page, width, 'Switch to client workspace');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('account-id')).toHaveText('shared-account');
    await expect(page.getByTestId('account-role')).toHaveText('worker');
    const clientNavigation = page.getByRole('navigation', { name: width < 881 ? 'Mobile dashboard navigation' : 'Dashboard navigation', exact: true });
    await expect(clientNavigation.getByRole('button', { name: width < 881 ? 'Browse tab' : 'Browse', exact: true })).toBeVisible();
    await useAccountAction(page, width, 'Switch to provider workspace');
    await expect(page).toHaveURL(/\/worker\/dashboard$/);
    await expect(page.getByTestId('current-route')).toHaveText('/worker/dashboard');
    const providerNavigation = page.getByRole('navigation', { name: width < 881 ? 'Mobile dashboard navigation' : 'Dashboard navigation', exact: true });
    await expect(providerNavigation.getByRole('button', { name: width < 881 ? 'My Work tab' : 'My Work', exact: true })).toBeVisible();
    await expect(page.getByTestId('account-id')).toHaveText('shared-account');
    await expect(page.getByTestId('account-role')).toHaveText('worker');
    expect(accountRequests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 390 || width === 1440) await page.screenshot({ path: test.info().outputPath('shared-account-' + width + '.png'), fullPage: true });
  });

  test(`existing client opens worker setup with the same account at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/__account-workspaces?role=client');
    await useAccountAction(page, width, 'Offer services');
    await expect(page).toHaveURL(/\/seller\/onboarding$/);
    await expect(page.getByTestId('account-id')).toHaveText('shared-account');
    await expect(page.getByTestId('account-role')).toHaveText('client');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
