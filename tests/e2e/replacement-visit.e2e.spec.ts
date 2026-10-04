import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__replacement-visit*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/replacement-visit-journey.tsx"></script></body></html>` }));
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`both participants see the confirmed replacement at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let accepted = false;
    await page.route("**/rest/v1/booking_case_replacement_visits?*", (route) => route.fulfill({ json: [{
      id: "visit-1", case_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", booking_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      slot_id: 12, status: accepted ? "accepted" : "proposed", reason: "The provider missed the original appointment.",
      client_accepted_at: "2026-10-04T08:00:00Z", provider_accepted_at: accepted ? "2026-10-04T08:10:00Z" : null,
      started_at: null, delivery_note: null, delivery_storage_path: null,
    }] }));
    await page.route("**/rest/v1/service_slots?*", (route) => route.fulfill({ json: {
      id: 12, start_ts: "2026-10-10T08:00:00+08:00", end_ts: "2026-10-10T09:00:00+08:00",
    } }));
    await page.route("**/rest/v1/rpc/respond_booking_case_replacement", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ p_visit_id: "visit-1", p_accept: true });
      accepted = true;
      await route.fulfill({ json: { id: "visit-1", status: "accepted" } });
    });
    await page.goto("/__replacement-visit?role=provider");
    await expect(page.getByText("Client: Accepted")).toBeVisible();
    await expect(page.getByText("Provider: Awaiting response")).toBeVisible();
    await page.getByRole("button", { name: "Accept time" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/Both participants accepted/)).toBeVisible();
    await page.goto("/__replacement-visit?role=client");
    await expect(page.getByText(/Replacement time confirmed/)).toBeVisible();
    await expect(page.getByText(/Both participants accepted/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
