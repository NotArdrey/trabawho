import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__pagination-journey*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/pagination-journey.tsx"></script></body></html>` }));
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`support pagination fits and works at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/__pagination-journey");
    const pagination = page.getByRole("navigation", { name: "Support case pages" });
    await expect(pagination.getByRole("button", { name: "Page 5, current page" })).toBeVisible();
    await pagination.getByRole("button", { name: "Next" }).click();
    await expect(pagination.getByRole("button", { name: "Page 6, current page" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
