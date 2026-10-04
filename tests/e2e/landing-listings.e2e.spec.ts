import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/rest/v1/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").at(-1);
    const rows = table === "services" ? [{
      id: 2, seller_id: "listing-provider", title: "Chemical Making", active: true,
      base_price: 23123, metadata: { service_type: "Others", custom_service_type: "Manufacturing",
        rate_basis: "per-project", booking_mode: "with-slots" },
    }, {
      id: 1, seller_id: "listing-provider", title: "Older service", active: true,
      base_price: 500, metadata: {},
    }] : table === "sellers" ? [{
      user_id: "listing-provider", display_name: "Jose Ramos",
      profile_photo: "/provider-photo.jpg", is_verified: true,
    }] : table === "seller_rating_aggregates" ? [{
      seller_id: "listing-provider", avg_rating: 4.7, rating_count: 3,
    }] : [];
    await route.fulfill({ json: rows });
  });
  await page.route("**/provider-photo.jpg", (route) => route.fulfill({ status: 200,
    contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" />' }));
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`landing listing facts and search remain usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const section = page.getByRole("region", { name: "Recently listed services" });
    const card = section.getByRole("article");
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole("heading", { name: "Chemical Making" })).toBeVisible();
    await expect(card.getByText("Manufacturing", { exact: true })).toHaveCount(0);
    await expect(card.getByText("Chemical Making", { exact: true })).toHaveCount(1);
    await expect(card.getByText("Jose Ramos", { exact: true })).toBeVisible();
    await expect(card.getByText("Verified provider")).toBeVisible();
    await expect(card.locator('img[src="/provider-photo.jpg"]')).toBeVisible();
    await expect(section.getByRole("article")).toHaveCount(1);
    await expect(card.getByText("\u20b123,123/project", { exact: true })).toBeVisible();
    await expect(card.getByText(/3 provider reviews/)).toBeVisible();
    await expect(card.getByText("Check booking times")).toBeVisible();
    await expect(card.getByText("Schedule available")).toHaveCount(0);
    await expect(card.locator("img")).toHaveCount(1);
    expect((await card.boundingBox())?.height).toBeLessThan(420);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await section.screenshot({ path: testInfo.outputPath(`landing-${width}.png`) });
    const browse = card.getByRole("button", { name: "Browse similar services" });
    await browse.focus();
    await expect(browse).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/services\?q=Chemical\+Making$/);
    await expect(page.getByRole("searchbox", { name: "Search services and providers" })).toHaveValue("Chemical Making");
  });
}

test("listing fetch remains visible if the rating endpoint is unavailable", async ({ page }) => {
  await page.route("**/rest/v1/seller_rating_aggregates**", (route) => route.fulfill({
    status: 403, json: { code: "42501", message: "Permission denied" },
  }));
  await page.goto("/");
  const section = page.getByRole("region", { name: "Recently listed services" });
  await expect(section.getByRole("heading", { name: "Chemical Making" })).toBeVisible();
  await expect(section.getByText(/provider reviews/)).toHaveCount(0);
  await expect(section.getByRole("alert")).toHaveCount(0);
});
