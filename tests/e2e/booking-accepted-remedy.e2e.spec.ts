import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`accepted replacement is the primary booking schedule without a competing refund action at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/__booking-accepted-remedy*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
      </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/booking-accepted-remedy-journey.tsx"></script></body></html>` }));
    await page.route("**/rest/v1/booking_case_replacement_visits?*", (route) => route.fulfill({ json: [{
      booking_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", case_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      slot_id: 12, status: "accepted", accepted_at: "2026-10-04T08:00:00Z",
    }] }));
    await page.route("**/rest/v1/service_slots?*", (route) => route.fulfill({ json: [{
      id: 12, start_ts: "2026-10-05T09:00:00+08:00", end_ts: "2026-10-05T10:00:00+08:00",
    }] }));
    await page.route("**/rest/v1/booking_refunds?*", (route) => route.fulfill({ json: [] }));
    await page.goto("/__booking-accepted-remedy");

    await expect(page.getByText("Active visit date:")).toBeVisible();
    await expect(page.getByText("Oct 5, 2026")).toBeVisible();
    await expect(page.getByText("9:00 AM–10:00 AM PHT")).toBeVisible();
    await expect(page.getByText("2026-09-02")).toHaveCount(0);
    await expect(page.getByText("Demo booking — no charge")).toBeVisible();
    await expect(page.getByText("Demo ID:")).toBeVisible();
    await expect(page.getByText("PayMongo Card")).toHaveCount(0);
    await expect(page.getByText("Refund review")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Request refund review" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Problem with this visit? Contact support" }))
      .toHaveAttribute("href", "/support-cases?case=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb#case-conversation");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
