import { expect, test } from "@playwright/test";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "./helpers/supabase.js";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`admin support queue remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: /^Sign in$/ }).first().click();
    await page.getByLabel("Email").fill(DEMO_ADMIN_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await page.locator("form").getByRole("button", { name: /^Sign in$/ }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 20_000 });
    if (width < 881) await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("button", { name: "Support cases" }).click();
    await expect(page.getByRole("heading", { name: "Booking support cases" })).toBeVisible();
    await expect(page.getByText(/Refunds and payouts are not executed here/i)).toBeVisible();
    await expect(page.locator("main [role=alert]")).toHaveCount(0);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}
