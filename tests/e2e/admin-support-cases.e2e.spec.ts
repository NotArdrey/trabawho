import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createTestSupabaseClient, DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "./helpers/supabase.js";

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
    if (width < 881) await page.getByRole("button", { name: "Open navigation menu" }).click();
    const sidebar = width < 881 ? page.getByRole("dialog", { name: "Admin navigation" })
      : page.getByRole("complementary", { name: "Admin Navigation Sidebar" });
    await expect(sidebar.getByRole("button", { name: /Account Management/ }).locator("span").last()).toHaveText(/^\d+$/, { timeout: 10_000 });
    const rail = await sidebar.getByTestId("admin-sidebar-content").evaluate((element) => {
      const edge = element.getBoundingClientRect().right;
      return { client: element.clientWidth, scroll: element.scrollWidth,
        offenders: [...element.querySelectorAll("*")].filter((child) => child.getBoundingClientRect().right > edge + 1)
          .slice(0, 8).map((child) => ({ tag: child.tagName, className: String(child.className).slice(0, 80), overBy: Math.round(child.getBoundingClientRect().right - edge) })) };
    });
    expect(rail.scroll, `Sidebar overflows at ${width}px: ${JSON.stringify(rail)}`).toBeLessThanOrEqual(rail.client);
    if (width < 881) await page.getByRole("button", { name: "Support cases" }).click();
    await expect(page.getByText(/Refunds and payouts are not executed here/i)).toBeVisible();
    await expect(page.locator("main [role=alert]")).toHaveCount(0);
    const review = page.getByRole("button", { name: "Review case" }).first();
    if (await review.count()) {
      await expect(page.getByRole("toolbar", { name: "Filter results" })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Active, \d+$/ })).toBeVisible();
      await expect(page.getByRole("region", { name: "Reported issue" }).first()).toBeVisible();
      await review.click();
      const dialog = page.getByRole("dialog", { name: "Support case detail" });
      await expect(dialog).toBeVisible();
      await expect(page.getByRole("heading", { name: "Payment attempts" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Recorded timeline" })).toBeVisible();
      const scrollContent = dialog.getByTestId("support-case-scroll-content");
      expect(await scrollContent.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe("none");
      await expect(scrollContent).toHaveAttribute("tabindex", "0");
      const headerTop = await dialog.getByRole("heading", { name: "Support case detail" }).evaluate((element) => element.getBoundingClientRect().top);
      const closeButtons = dialog.getByRole("button", { name: "Close" });
      const footerTop = await closeButtons.last().evaluate((element) => element.getBoundingClientRect().top);
      await scrollContent.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      expect(await dialog.getByRole("heading", { name: "Support case detail" }).evaluate((element) => element.getBoundingClientRect().top)).toBe(headerTop);
      expect(await closeButtons.last().evaluate((element) => element.getBoundingClientRect().top)).toBe(footerTop);
      await closeButtons.first().click();
    }
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  });
}

test("a client cannot record an admin case follow-up", async () => {
  const client = createTestSupabaseClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email: "demo.user@giglink.test",
    password: DEMO_PASSWORD,
  });
  expect(signInError).toBeNull();
  const { error } = await client.rpc("record_booking_support_followup", {
    p_case_id: randomUUID(),
    p_action: "request_information",
    p_target_party: "client",
    p_reason: "Please provide a clear timeline and supporting evidence.",
    p_operation_id: randomUUID(),
  });
  expect(error?.code).toBe("42501");
});
