import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD } from "./helpers/supabase.js";

test("bookings recover from an initial network failure and show the existing dispute", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Sign in$/ }).first().click();
  await page.getByLabel("Email").fill("demo.user@giglink.test");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.locator("form").getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toHaveCount(0, { timeout: 20_000 });
  let blocked = true;
  await page.route("**/rest/v1/bookings?**", (route) => blocked ? route.abort("failed") : route.continue());
  await page.goto("/bookings");
  await expect(page.getByRole("button", { name: "Retry loading bookings" })).toBeVisible();
  await expect(page.locator(".booking-skeleton-card")).toHaveCount(0);
  await expect(page.getByTestId("bookings-empty-state")).toHaveCount(0);
  blocked = false;
  await page.getByRole("button", { name: "Retry loading bookings" }).click();
  await expect(page.getByRole("button", { name: "Retry loading bookings" })).toHaveCount(0);
  await expect(page.getByText("Support case open").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".booking-skeleton-card")).toHaveCount(0);
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`different gigs from one provider retain their own titles at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const seller = { user_id: "worker-1", display_name: "Jose Ramos", is_verified: true, search_meta: { service_type: "Shared provider category" } };
    const services = [
      { id: 97, seller_id: "worker-1", title: "Appliance Installation & Repair", description: "Installs appliances", base_price: 850, active: true, metadata: { service_type: "Stale category", rate_basis: "per-project" } },
      { id: 101, seller_id: "worker-1", title: "Home maintenance", description: "General home repairs", base_price: 10000, active: true, metadata: { rate_basis: "per-project" } },
    ];
    await page.route("**/rest/v1/**", async (route) => {
      const table = new URL(route.request().url()).pathname.split("/").pop();
      await route.fulfill({ json: table === "services" ? services : table === "sellers" ? [seller] : [] });
    });
    await page.goto("/services");
    await expect(page.getByRole("heading", { name: "Appliance Installation & Repair", exact: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Home maintenance", exact: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Shared provider category" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
