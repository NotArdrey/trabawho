import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`profile photo can be viewed in its dialog at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/__profile-photo*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
      </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/profile-photo-journey.tsx"></script></body></html>` }));
    await page.goto("/__profile-photo");
    await page.getByRole("button", { name: "Change profile photo" }).click();

    const dialog = page.getByRole("dialog", { name: "Change profile photo" });
    await expect(dialog.getByRole("img", { name: "Your current profile photo" })).toBeVisible();
    await dialog.getByRole("button", { name: "View larger" }).click();
    await expect(dialog.getByRole("img", { name: "Your current profile, enlarged" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await dialog.getByRole("button", { name: "Hide larger view" }).click();
    await expect(dialog.getByRole("img", { name: "Your current profile, enlarged" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });
}
