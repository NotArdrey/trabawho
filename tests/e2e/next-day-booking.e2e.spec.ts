import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-05T09:00:00Z") }); // 5 PM PHT
  await page.route("**/__next-day-booking-journey", (route) => route.fulfill({
    contentType: "text/html",
    body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
      </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/next-day-booking-journey.tsx"></script></body></html>`,
  }));
});

for (const width of [390, 768, 1024, 1280, 1440]) test(`same-day booking stays unavailable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/__next-day-booking-journey");
  await expect(page.getByRole("gridcell", { name: /Monday, October 5, 2026, booking available from tomorrow onward/i })).toBeDisabled();
  await expect(page.getByRole("gridcell", { name: /Tuesday, October 6, 2026, 1 slot available/i })).toBeEnabled();
  await page.getByRole("gridcell", { name: /Tuesday, October 6, 2026, 1 slot available/i }).click();
  await page.getByRole("button", { name: /9:00 AM.*10:00 AM/i }).click();
  await page.getByRole("button", { name: "Review booking" }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-booked-date", "2026-10-06");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
