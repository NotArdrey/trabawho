import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`future paid booking explains disabled start work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/e2e/fixtures/start-work-availability.html");

    const start = page.getByRole("button", { name: "Start work" });
    await expect(start).toBeVisible();
    await expect(start).toBeDisabled();
    await expect(start).toHaveAttribute("aria-describedby", /start-reason/);
    const reason = page.getByText(/Start work becomes available.*30 minutes before the appointment/);
    await expect(reason).toBeVisible();
    const startBounds = await start.boundingBox();
    const reasonBounds = await reason.boundingBox();
    expect(startBounds).not.toBeNull();
    expect(reasonBounds).not.toBeNull();
    expect(reasonBounds!.y).toBeGreaterThan(startBounds!.y + startBounds!.height);
    if (width >= 768) {
      const messageBounds = await page.getByRole("button", { name: "Message client" }).boundingBox();
      expect(messageBounds).not.toBeNull();
      expect(Math.abs(startBounds!.y - messageBounds!.y)).toBeLessThanOrEqual(2);
    } else {
      const navBounds = await page.getByRole("navigation", { name: "Booking actions" }).boundingBox();
      expect(navBounds).not.toBeNull();
      expect(startBounds!.width).toBeGreaterThan(navBounds!.width * 0.9);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("start work remains enabled near the appointment and still asks for confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/e2e/fixtures/start-work-availability.html?soon");

  const start = page.getByRole("button", { name: "Start work" });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByRole("dialog", { name: "Start this work?" })).toBeVisible();
  await page.getByRole("dialog", { name: "Start this work?" }).getByRole("button", { name: "Cancel" }).click();
});
