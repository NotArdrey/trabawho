import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`admin review and audit cards remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/e2e/fixtures/admin-content-cards.html");
    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
    await expect(page.getByText("5 / 5 stars")).toBeVisible();
    await expect(page.getByText("No written comment")).toBeVisible();
    await expect(page.getByText("Identity review").first()).toBeVisible();
    await expect(page.getByText("confirmed → cancelled")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.getByRole("button", { name: "Delete review" }).first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Review by Sofia Garcia Cruz for Andrea Mendoza Navarro");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("confirmed-count")).toHaveText("0");
    await page.getByRole("button", { name: "Delete review" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete review" }).click();
    await expect(page.getByTestId("confirmed-count")).toHaveText("1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
