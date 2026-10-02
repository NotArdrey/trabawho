import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const services = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, seller_id: "filter-provider", title: `Pipe repair ${index + 1}`,
    active: true, description: "Local plumbing repairs", base_price: 100 + index, price_type: "fixed", duration_minutes: 60,
    metadata: { service_type: index === 7 ? "Cleaner" : "Technician", rate_basis: "per-project" }, created_at: "2026-01-01" }));
  await page.route("**/rest/v1/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").at(-1);
    const rows = table === "services" ? services : table === "sellers" ? [{ user_id: "filter-provider", display_name: "Ana Santos", city: "Malolos", province: "Bulacan" }] : [];
    await route.fulfill({ json: rows });
  });
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`marketplace filters combine, survive reload, and reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services?page=2");
    await expect(page.getByText("Showing 7-8 of 8 services", { exact: true })).toBeVisible();
    const search = page.getByRole("searchbox", { name: "Search services and providers" });
    await search.fill("Santos repair");
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page.getByText("Showing 1-6 of 8 services", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear active filters" })).toBeVisible();
    if (width <= 880) await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByRole("button", { name: /Cleaner.*1 services/ }).click();
    await page.getByPlaceholder("City or province").fill("Bulacan");
    await expect(page).toHaveURL(/category=Cleaner/);
    if (width <= 880) await page.getByRole("button", { name: "Close filters" }).click();
    await expect(page.getByRole("heading", { name: "Pipe repair 8", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pipe repair 1", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(search).toHaveValue("Santos repair");
    await expect(page.getByText("Showing 1-1 of 1 services", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear active filters" }).click();
    await expect(search).toHaveValue("");
    await expect(page).not.toHaveURL(/category=|location=|q=/);
    await expect(page.getByText("Showing 1-6 of 8 services", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
