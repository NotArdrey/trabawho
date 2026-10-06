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
    const futureStart = new Date(Date.now() + 5 * 24 * 60 * 60_000);
    const futureEnd = new Date(futureStart.getTime() + 60 * 60_000);
    await page.route("**/rest/v1/booking_case_replacement_visits?*", (route) => route.fulfill({ json: [{
      id: "visit-1", case_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", booking_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      slot_id: 12, status: accepted ? "accepted" : "proposed", reason: "The provider missed the original appointment.",
      client_accepted_at: "2026-10-04T08:00:00Z", provider_accepted_at: accepted ? "2026-10-04T08:10:00Z" : null,
      started_at: null, delivery_note: null, delivery_storage_path: null,
    }] }));
    await page.route("**/rest/v1/service_slots?*", (route) => route.fulfill({ json: {
      id: 12, start_ts: futureStart.toISOString(), end_ts: futureEnd.toISOString(),
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
    await page.getByRole("alertdialog").getByRole("button", { name: "Accept visit time" }).click();
    await expect(page.getByText(/Both participants accepted/)).toBeVisible();
    const start = page.getByRole("button", { name: "Start replacement work" });
    await expect(start).toBeDisabled();
    await expect(start).toHaveAttribute("aria-describedby", /replacement-start-/);
    await page.goto("/__replacement-visit?role=client");
    await expect(page.getByText("Visit confirmed")).toHaveCount(2);
    await expect(page.getByText(/Both participants accepted/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("provider submits replacement work and client confirmation completes it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  let status: "accepted" | "delivered" | "completed" = "accepted";
  let startedAt: string | null = null;
  await page.route("**/rest/v1/booking_case_replacement_visits?*", (route) => route.fulfill({ json: [{
    id: "visit-1", case_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", booking_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    slot_id: 12, status, reason: "The provider missed the original appointment.",
    client_accepted_at: "2026-10-04T08:00:00Z", provider_accepted_at: "2026-10-04T08:10:00Z",
    started_at: startedAt, delivery_note: status !== "accepted" ? "The replacement service was completed and checked." : null,
    delivery_storage_path: null,
  }] }));
  await page.route("**/rest/v1/service_slots?*", (route) => route.fulfill({ json: {
    id: 12, start_ts: "2020-10-05T09:00:00+08:00", end_ts: "2020-10-05T10:00:00+08:00",
  } }));
  await page.route("**/rest/v1/rpc/start_booking_case_replacement", (route) => {
    startedAt = "2026-10-05T08:40:00Z";
    return route.fulfill({ json: { id: "visit-1", status } });
  });
  await page.route("**/rest/v1/rpc/deliver_booking_case_replacement", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ p_visit_id: "visit-1",
      p_note: "The replacement service was completed and checked.", p_storage_path: null });
    status = "delivered";
    return route.fulfill({ json: { id: "visit-1", status } });
  });
  await page.route("**/rest/v1/rpc/confirm_booking_case_replacement", (route) => {
    status = "completed";
    return route.fulfill({ json: { id: "visit-1", status } });
  });

  await page.goto("/__replacement-visit?role=provider");
  await page.getByRole("button", { name: "Start replacement work" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Start work" }).click();
  await page.getByRole("textbox", { name: "Completed work notes" }).fill("The replacement service was completed and checked.");
  await page.getByRole("button", { name: "Review and submit work" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("The replacement service was completed and checked.");
  expect(status).toBe("accepted");
  await page.getByRole("alertdialog").getByRole("button", { name: "Submit work" }).click();
  await expect(page.getByText("Waiting for client confirmation.")).toBeVisible();
  await page.goto("/__replacement-visit?role=client");
  await page.getByRole("button", { name: "Confirm completed visit" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm completion" }).click();
  await expect(page.getByText("The client confirmed this visit. The case is resolved.")).toBeVisible();
  await page.goto("/__replacement-visit?role=provider");
  await expect(page.getByText("The client confirmed this visit. The case is resolved.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
