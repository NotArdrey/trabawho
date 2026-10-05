import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__availability-consistency", async (route) => {
    await route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script>
      </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/availability-consistency-journey.tsx"></script></body></html>` });
  });
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`duplicate availability is guarded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/__availability-consistency");
    await page.getByRole("button", { name: "Add worker time" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("alert")).toContainText("overlaps an existing slot");
    await expect(page.getByRole("status", { name: "Time saved" })).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Open client calendar" }).click();
    const availableDate = page.getByRole("gridcell", { name: /1 slot available/i });
    await availableDate.click();
    await expect(page.getByRole("button", { name: /9:00 AM.*10:00 AM/i })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
