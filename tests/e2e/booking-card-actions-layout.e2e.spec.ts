import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__booking-card-actions-journey", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/booking-card-actions-journey.tsx"></script></body></html>` }));
});

for (const width of [390, 768, 1280]) test(`booking actions stay organized at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/__booking-card-actions-journey");
  const pay = page.getByRole("button", { name: "Pay Balance" });
  const report = page.getByRole("button", { name: "Report a problem" });
  await expect(pay).toBeVisible();
  await expect(report).toBeVisible();
  await expect(report).toHaveClass(/bg-amber-50/);
  const reportColor = await report.evaluate((button) => getComputedStyle(button).backgroundColor);
  const payColor = await pay.evaluate((button) => getComputedStyle(button).backgroundColor);
  expect(reportColor).not.toBe(payColor);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (width === 1280) {
    const payBox = await pay.boundingBox();
    const reportBox = await report.boundingBox();
    expect(payBox && reportBox && Math.abs(payBox.y - reportBox.y) <= 2).toBe(true);
  }
});
