import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`marketplace search and sort do not overlap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services");

    const search = page.getByRole("searchbox", { name: "Search services and providers" });
    const sort = page.getByRole("combobox", { name: "Sort services" });
    await expect(search).toBeVisible();
    await expect(sort).toBeVisible();

    const searchBox = await search.boundingBox();
    const sortBox = await sort.boundingBox();
    expect(searchBox).not.toBeNull();
    expect(sortBox).not.toBeNull();
    if (!searchBox || !sortBox) return;
    expect(searchBox.y + searchBox.height).toBeLessThanOrEqual(sortBox.y);
    expect(sortBox.x + sortBox.width).toBeLessThanOrEqual(width);

    if (width <= 880) {
      const filters = page.getByRole("button", { name: "Filters", exact: true });
      await expect(filters).toBeVisible();
      const filterBox = await filters.boundingBox();
      expect(filterBox).not.toBeNull();
      if (filterBox) expect(sortBox.x + sortBox.width).toBeLessThanOrEqual(filterBox.x);
      await filters.click();
      await expect(page.getByRole("complementary", { name: "Browse filters" })).toBeVisible();
      await page.getByRole("button", { name: "Close filters" }).click();
    }
    await sort.click();
    await page.getByRole("option", { name: "Highest rated" }).click();
    await expect(sort).toContainText("Highest rated");
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}
