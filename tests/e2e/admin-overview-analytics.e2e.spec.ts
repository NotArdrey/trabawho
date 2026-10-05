import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`admin overview and analytics stay distinct and usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/e2e/fixtures/admin-overview-analytics.html");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Account snapshot")).toBeVisible();
    await expect(page.getByRole("button", { name: /support cases/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity in the last 30 days" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.getByRole("button", { name: /explore analytics/i }).click();
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity in the last 30 days" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Current inventory" })).toBeVisible();
    await expect(page.getByText("Account snapshot")).toHaveCount(0);
    await expect(page.getByRole("img", { name: /Account registrations: 3 in this period/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: "Last 7 days" }).click();
    await expect(page.getByRole("heading", { name: "Activity in the last 7 days" })).toBeVisible();
    await expect(page.getByText("changing the period does not affect these figures", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Back to overview" }).click();
    await page.getByRole("button", { name: /identity reviews/i }).click();
    await expect(page.getByText("Opened identity")).toBeVisible();
  });
}
