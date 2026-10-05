import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`account filters stay usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/e2e/fixtures/admin-account-filters.html");
    const search = page.getByRole("searchbox", { name: "Search accounts" });
    const roles = page.getByRole("toolbar", { name: "Role" });
    await expect(search).toBeVisible();
    await expect(roles.getByRole("button", { name: "All roles" })).toHaveAttribute("aria-pressed", "true");
    await roles.getByRole("button", { name: "Worker" }).click();
    await expect(page.getByRole("heading", { name: "Ben Worker" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ana Client" })).toHaveCount(0);
    await search.fill("missing");
    await expect(page.getByRole("heading", { name: "No matching accounts" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("heading", { name: "Ana Client" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 390 || width === 1440) await page.screenshot({ path: test.info().outputPath("account-filters.png"), fullPage: true });
  });
}
