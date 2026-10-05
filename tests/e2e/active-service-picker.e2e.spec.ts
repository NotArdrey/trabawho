import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`active service picker works at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/e2e/fixtures/active-service-picker.html");

    const picker = page.getByRole("combobox", { name: "Active service" });
    await expect(picker).toBeVisible();
    await expect(picker).toContainText("Chemical Making");

    await picker.click();
    await page.getByRole("option", { name: "Appliance Installation & Repair" }).click();
    await expect(page.getByTestId("selected-service")).toHaveText("Appliance Installation & Repair");
    await expect(picker).toContainText("Appliance Installation & Repair");
    const summary = page.getByRole("region", { name: "Current service summary" });
    await expect(summary.getByRole("heading", { name: "Jose Miguel Miguel Ramos" })).toBeVisible();
    await expect(summary.getByRole("button", { name: "Edit service" })).toHaveCount(0);
    await expect(summary.getByRole("button", { name: "Delete service" })).toHaveCount(0);

    await page.getByRole("button", { name: "Edit service" }).click();
    await expect(page.getByTestId("edit-count")).toHaveText("1");
    await page.getByRole("button", { name: "Delete service" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Appliance Installation & Repair");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

    const hasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}

test("single-service actions remain available without a dropdown on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/e2e/fixtures/active-service-picker.html?single");

  await expect(page.getByRole("combobox", { name: "Active service" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit service" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete service" })).toBeVisible();

  const buttonsFit = await page.getByRole("region", { name: "Manage your services" }).evaluate((region) =>
    [...region.querySelectorAll("button")].every((button) => {
      const bounds = button.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= window.innerWidth && bounds.height >= 44;
    }),
  );
  expect(buttonsFit).toBe(true);
});
