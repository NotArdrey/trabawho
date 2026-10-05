import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__provider-booking-conflict-journey", (route) => route.fulfill({
    contentType: "text/html",
    body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
      </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/provider-booking-conflict-journey.tsx"></script></body></html>`,
  }));
});

for (const width of [390, 768, 1024, 1280, 1440]) test(`provider conflict is visible at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/__provider-booking-conflict-journey");
  const warning = page.getByRole("alert");
  await expect(warning).toContainText("Schedule conflict with 1 other booking");
  await expect(warning).toContainText("House painting for Bea Client");
  const openOther = warning.getByRole("button", { name: "View conflicting booking" });
  await expect(openOther).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await openOther.click();
  await expect(page.locator("body")).toHaveAttribute("data-opened-booking", "other-job");
});
