import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__availability-consistency**", async (route) => {
    await route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script>
      </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/availability-consistency-journey.tsx"></script></body></html>` });
  });
});

function tomorrowKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`duplicate availability is guarded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/__availability-consistency");
    await page.getByRole("button", { name: "Add worker time" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("alert")).toContainText("overlaps an existing slot");
    await expect(page.getByRole("status", { name: "Time saved" })).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Open client calendar" }).click();
    const availableDate = page.getByRole("gridcell", { name: /1 slot available/i });
    await availableDate.click();
    await expect(page.getByRole("button", { name: /9:00 AM.*10:00 AM/i })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`reserved client time is disabled while a later time remains available at ${width}px`, async ({ page }) => {
    const date = tomorrowKey();
    const available = { id: 2, service_id: 7, start_ts: new Date(`${date}T10:00:00+08:00`).toISOString(),
      end_ts: new Date(`${date}T11:00:00+08:00`).toISOString(), capacity: 1, booked_count: 0 };
    await page.route("**/rest/v1/rpc/list_available_service_slots", async (route) => {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify([available]) });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/__availability-consistency?live=1&date=${date}`);
    await page.getByRole("button", { name: "Open client calendar" }).click();
    await expect(page.getByRole("gridcell", { name: /1 slot available/i })).toBeEnabled();
    await page.getByRole("gridcell", { name: /1 slot available/i }).click();
    await expect(page.getByRole("button", { name: /9:00 AM.*10:00 AM.*No spots left/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /10:00 AM.*11:00 AM.*1 spot left/i })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
