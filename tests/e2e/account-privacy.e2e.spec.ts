import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`identity name is locked and autofilled password submits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/__account-privacy*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
      </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/account-privacy-journey.tsx"></script></body></html>` }));
    await page.goto("/__account-privacy");
    await expect(page.getByText("First name")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "First name" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Login email" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save contact and location" })).toBeVisible();
    await page.getByLabel("Current password").evaluate((element: HTMLInputElement) => { element.value = "old-password"; });
    await page.getByLabel("New password", { exact: true }).fill("new-password");
    await page.getByLabel("Confirm new password").fill("new-password");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByTestId("password-requests")).toHaveText("1");
    await expect(page.getByLabel("Current password")).toHaveValue("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
