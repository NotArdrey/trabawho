import { expect, test } from "@playwright/test";

const userId = "22222222-2222-4222-8222-222222222222";
const sellerId = "33333333-3333-4333-8333-333333333333";
const bookingId = "11111111-1111-4111-8111-111111111111";
const createdAt = new Date().toISOString();
const booking = { id: bookingId, buyer_id: userId, seller_id: sellerId, service_id: 1, status: "completed", metadata: {}, created_at: createdAt, updated_at: createdAt };
const service = { id: 1, seller_id: sellerId, title: "Plumbing Leak Repair", active: true, metadata: {}, base_price: 500, price_type: "fixed", created_at: createdAt };

test.beforeEach(async ({ page }) => {
  const user = { id: userId, email: "fixture@example.test", role: "authenticated", aud: "authenticated", user_metadata: {}, app_metadata: {} };
  const token = `e30.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
  await page.route("**/auth/v1/**", async (route) => {
    await route.fulfill({ json: route.request().url().includes("/token") ? { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600, user } : user });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    const rows: Record<string, unknown[]> = {
      profiles: [{ user_id: userId, role: "admin", full_name: "Sofia Client", email: "fixture@example.test", account_status: "active", created_at: createdAt }],
      bookings: [booking], services: [service], sellers: [{ user_id: sellerId, display_name: "Arnold Castillo" }],
      booking_audit_events: [{ id: 1, booking_id: bookingId, actor_id: userId, actor_role: "buyer", event_type: "buyer_confirmed_completion", reason: "Confirmed successful plumbing repair", from_status: "in_progress", to_status: "completed", created_at: createdAt }],
      booking_support_admin_actions: [], identity_review_actions: [{ id: "identity-action-1", actor_id: userId, review_id: "identity-1", decision: "APPROVED", reason: "Evidence reviewed and identity confirmed", created_at: createdAt }],
      booking_support_cases: [], reviews: [],
    };
    const data = rows[table || ""] || [];
    await route.fulfill({ headers: { "content-range": `0-${Math.max(0, data.length - 1)}/${data.length}` }, json: route.request().headers().accept?.includes("vnd.pgrst.object") ? data[0] || null : data });
  });
  await page.route("**/__activity-journey*", async (route) => {
    await route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/activity-journey.tsx"></script></body></html>` });
  });
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`admin analytics and audit search work at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/__activity-journey?mode=admin");
    await page.getByRole("button", { name: "Explore analytics" }).click();
    await expect(page.getByRole("heading", { name: "Account registrations" })).toBeVisible();
    await expect(page.getByText("Currently active listings")).toBeVisible();
    if (width === 1440) {
      await page.getByRole("combobox", { name: "Period" }).click();
      await page.getByRole("option", { name: "Last 7 days" }).click();
      await expect(page.getByRole("heading", { name: "Account registrations" })).toBeVisible();
      await page.getByRole("button", { name: "View daily breakdown" }).first().click();
      await expect(page.getByRole("list", { name: "Account registrations daily counts" }).getByRole("listitem")).toHaveCount(1);
      await page.getByRole("region", { name: "Hide daily breakdown" }).first().getByRole("button", { name: /All days/ }).click();
      await expect(page.getByRole("list", { name: "Account registrations daily counts" }).getByRole("listitem")).toHaveCount(7);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`analytics-${width}.png`), fullPage: true });
    if (width < 881) await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("button", { name: "Audit Logs", exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: "Buyer confirmed completion" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search loaded audit logs" }).fill("identity approved");
    await expect(page.getByText("Evidence reviewed and identity confirmed")).toBeVisible();
    await expect(page.getByText("Confirmed successful plumbing repair")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`audit-${width}.png`), fullPage: true });
    await page.getByRole("searchbox", { name: "Search loaded audit logs" }).fill("nonexistent action");
    await expect(page.getByRole("heading", { name: "No matching audit events" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("review uses authoritative participants and preserves its draft on a failed save", async ({ page }) => {
  const writes: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/reviews*", async (route) => {
    if (route.request().method() === "POST") {
      writes.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill(writes.length === 1 ? { status: 503, json: { code: "service_unavailable", message: "Private diagnostics" } } : { json: { id: 1 } });
    } else await route.fulfill({ json: null });
  });
  await page.goto("/__activity-journey");
  await page.getByPlaceholder("How was the service?").fill("Good service");
  await page.getByRole("button", { name: "Submit Review" }).click();
  await expect(page.getByRole("alert")).toContainText("Your draft is still here");
  await expect(page.getByPlaceholder("How was the service?")).toHaveValue("Good service");
  await page.getByRole("button", { name: "Submit Review" }).click();
  await expect(page.getByText("Review saved")).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({ seller_id: sellerId, reviewer_id: userId, booking_id: bookingId, body: "Good service" });
});

test("client dashboard omits global search and updates when connection resumes", async ({ page }) => {
  let status = "completed";
  await page.route("**/rest/v1/bookings*", async (route) => { await route.fulfill({ json: [{ ...booking, status }] }); });
  await page.goto("/__activity-journey?mode=dashboard");
  await expect(page.getByRole("heading", { name: "Good to see you, Kuh." })).toBeVisible();
  await expect(page.getByPlaceholder("Search services, providers, locations")).toHaveCount(0);
  await expect(page.getByText("Review window open")).toBeVisible();
  status = "cancelled";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/Plumbing Leak Repair.*Cancelled/)).toBeVisible();
});

test("booking search finds clients and references, and global search opens marketplace results", async ({ page }) => {
  await page.goto("/__activity-journey?mode=bookings&filter=all");
  const search = page.getByRole("searchbox", { name: "Search bookings", exact: true });
  await expect(page.getByText("Showing 1 of 1 booking")).toBeVisible();
  await search.fill("Sofia");
  await expect(page.getByText("Showing 1 of 1 booking")).toBeVisible();
  await search.fill(bookingId);
  await expect(page.getByText("Showing 1 of 1 booking")).toBeVisible();
  await search.fill("nonexistent provider");
  await expect(page.getByText("Showing 0 of 1 booking")).toBeVisible();
  const globalSearch = page.getByRole("searchbox", { name: "Search services, providers, locations", exact: true });
  await globalSearch.fill("Plumbing Manila");
  await globalSearch.press("Enter");
  await expect(page).toHaveURL(/\/services\?/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("Plumbing Manila");
});

test("audit logs preserve available sources and identify an unavailable source", async ({ page }) => {
  await page.route("**/rest/v1/identity_review_actions*", async (route) => { await route.fulfill({ status: 503, json: { message: "Private database failure" } }); });
  await page.goto("/__activity-journey?mode=admin");
  await page.getByRole("button", { name: "Explore analytics" }).click();
  await expect(page.getByRole("heading", { name: "Account registrations" })).toBeVisible();
  await page.getByRole("button", { name: "Audit Logs", exact: true }).filter({ visible: true }).click();
  await expect(page.getByText(/History is incomplete: Identity decisions/)).toBeVisible();
  await expect(page.getByText("Confirmed successful plumbing repair")).toBeVisible();
  await expect(page.getByText("Private database failure")).toHaveCount(0);
});
