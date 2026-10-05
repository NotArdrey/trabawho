import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__provider-calendar-journey", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/provider-calendar-journey.tsx"></script></body></html>` }));
});

for (const width of [390, 768, 1280]) {
  test(`slot editing uses one shared booking limit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/__provider-calendar-journey");
    await page.getByRole("button", { name: "Edit time slot" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("one booking at a time across all your services");
    await expect(dialog.getByRole("spinbutton", { name: "Slot capacity" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved capacity: 1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
