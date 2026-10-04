import { expect, test, type BrowserContext } from "@playwright/test";
import { DEMO_PASSWORD } from "./helpers/supabase.js";

const bookingId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const providerId = "33333333-3333-4333-8333-333333333333";
const caseId = "44444444-4444-4444-8444-444444444444";
const reportedIssue = "The provider did not arrive for our confirmed repair appointment.";
const createdAt = "2026-10-03T09:00:00Z";

async function setup(context: BrowserContext, role: "client" | "provider" = "client", acceptedReplacement = false) {
  const state = { opened: false, followup: false, closed: false, failQueue: false, submissions: 0 };
  const user = { id: userId, email: "fixture@example.test", role: "authenticated", aud: "authenticated", user_metadata: {}, app_metadata: {} };
  const token = `e30.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
  await context.route("**/auth/v1/**", (route) => route.fulfill({ json: route.request().url().includes("/token")
    ? { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600, user } : user }));
  // Exercise fallback reconciliation with no live realtime connection or writes.
  await context.routeWebSocket("**/realtime/v1/**", (socket) => socket.close());
  const supportCase = () => ({
    id: caseId, booking_id: bookingId, reporter_id: userId, case_type: "provider_no_show", reason: reportedIssue,
    policy_route: "support_review", policy_reason: null, storage_path: null, created_at: createdAt,
    status: state.closed ? "closed" : state.followup ? "under_review" : "open", closed_at: null, refund_requested_at: null,
    resolution_status: acceptedReplacement ? "replacement_accepted" : null,
    latest_support_action: state.followup ? "request_information" : null,
    latest_support_target: state.followup ? "client" : null, latest_support_at: state.followup ? createdAt : null,
  });
  await context.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1) || "";
    if (table === "open_booking_support_case") {
      expect(route.request().postDataJSON()).toEqual({ p_booking_id: bookingId, p_case_type: "provider_no_show",
        p_reason: reportedIssue, p_storage_path: null, p_idempotency_key: `case:${bookingId}:provider_no_show` });
      state.opened = true; state.submissions++;
      await route.fulfill({ json: supportCase() });
      return;
    }
    if (table === "record_booking_support_followup") {
      expect(route.request().postDataJSON()).toMatchObject({ p_case_id: caseId, p_action: "request_information", p_target_party: "client" });
      state.followup = true;
      await route.fulfill({ json: { id: 1 } });
      return;
    }
    if (table === "booking_support_cases" && state.failQueue) {
      await route.fulfill({ status: 503, json: { message: "Private database diagnostics" } });
      return;
    }
    const rows: Record<string, unknown[]> = {
      booking_support_cases: state.opened ? [supportCase()] : [],
      booking_support_admin_actions: state.followup ? [{ id: 1, case_id: caseId, action: "request_information", target_party: "client",
        reason: "Please provide the appointment timeline and supporting evidence.", operation_id: "followup-1", created_at: createdAt }] : [],
      bookings: [{ id: bookingId, buyer_id: role === "client" ? userId : providerId, seller_id: role === "provider" ? userId : providerId, service_id: 1, status: "confirmed",
        start_ts: "2026-01-01T09:00:00Z", end_ts: "2026-01-01T10:00:00Z", total_amount: 500, currency: "PHP",
        payment_reference: null, payment_status: "paid", schedule_status: "confirmed", work_started_at: null, metadata: {}, dispute_status: state.opened ? "open" : "none" }],
      profiles: [{ user_id: role === "client" ? userId : providerId, full_name: "Case Client", email: "client@example.test", role: "client", account_status: "active" },
        { user_id: role === "provider" ? userId : providerId, full_name: "Case Provider", email: "provider@example.test", role: "worker", account_status: "active" }],
      services: [{ id: 1, seller_id: providerId, title: "Booked repair", metadata: {}, base_price: 500 }],
      sellers: [{ user_id: providerId, display_name: "Case Provider" }],
      payment_attempts: [{ id: "payment-1", purpose: "initial", status: "paid", payment_id: "pay_verified", amount: 540, currency: "PHP", created_at: createdAt, paid_at: createdAt }],
      booking_audit_events: state.opened ? [{ id: 1, event_type: "support_case_opened", actor_role: "buyer", reason: reportedIssue, created_at: createdAt }] : [],
      booking_case_replacement_visits: acceptedReplacement ? [{ booking_id: bookingId, case_id: caseId, slot_id: 12,
        status: "accepted", accepted_at: "2026-10-04T08:00:00Z" }] : [],
      service_slots: acceptedReplacement ? [{ id: 12, start_ts: "2026-10-10T08:00:00+08:00",
        end_ts: "2026-10-10T09:00:00+08:00" }] : [],
    };
    const data = rows[table] || [];
    // maybeSingle requests use the array media type; its caller converts the row.
    await route.fulfill({ json: route.request().headers().accept?.includes("vnd.pgrst.object") ? data[0] || null : data });
  });
  await context.route("**/__dispute-admin-journey*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/dispute-admin-journey.tsx"></script></body></html>` }));
  return state;
}

for (const role of ["client", "provider"] as const) {
  for (const width of [390, 768, 1024, 1280, 1440]) {
    test(`${role} sees the accepted replacement schedule on the case card at ${width}px`, async ({ page, context }) => {
      const state = await setup(context, role, true);
      state.opened = true;
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/__dispute-admin-journey?role=participant-${role}`);
      await expect(page.getByRole("heading", { name: "Your new visit" })).toBeVisible();
      await expect(page.getByText("Saturday, October 10, 2026")).toBeVisible();
      await expect(page.getByText("8:00 AM–9:00 AM PHT")).toBeVisible();
      await expect(page.getByText(/Both participants accepted this new schedule/)).toBeVisible();
      await page.getByRole("button", { name: "View support case" }).click();
      await expect(page.getByRole("link", { name: "Contact support about this visit" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Request refund review" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`a submitted booking dispute reaches an already-open admin queue at ${width}px`, async ({ page, context }, testInfo) => {
    const state = await setup(context);
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.goto("/__dispute-admin-journey?role=admin");
    await expect(page.getByText("No support cases yet")).toBeVisible();
    const clientPage = await context.newPage();
    await clientPage.goto("/__dispute-admin-journey");
    await clientPage.getByRole("button", { name: "Report a problem" }).click();
    await clientPage.getByRole("textbox", { name: "What happened?" }).fill(reportedIssue);
    await clientPage.getByRole("button", { name: "Open support case" }).click();
    await expect(clientPage.getByText("Support case saved for review. No refund was issued.")).toBeVisible();
    expect(state.submissions).toBe(1);

    await page.clock.fastForward(16_000);
    await expect(page.getByRole("region", { name: "Reported issue" })).toContainText(reportedIssue);
    await expect(page.getByRole("button", { name: /^Active, 1$/ })).toBeVisible();
    await page.getByRole("button", { name: "Review case" }).click();
    const dialog = page.getByRole("dialog", { name: "Support case detail" });
    await expect(dialog.getByText(`Booking reference: ${bookingId}`)).toBeVisible();
    await expect(dialog.getByText("Case Client", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Case Provider", { exact: true })).toBeVisible();
    await expect(dialog.getByText("initial: PHP 540 · paid")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Recorded timeline" })).toBeVisible();
    await dialog.getByRole("textbox", { name: "Reason and next step" }).fill("Please provide the appointment timeline and supporting evidence.");
    await page.clock.fastForward(16_000);
    await expect(dialog.getByRole("textbox", { name: "Reason and next step" })).toHaveValue("Please provide the appointment timeline and supporting evidence.");
    await dialog.getByRole("combobox", { name: "Information needed from" }).click();
    await page.getByRole("option", { name: "Client", exact: true }).click();
    await dialog.getByRole("button", { name: "Record follow-up" }).click();
    await expect(dialog.getByText("Support follow-up recorded. No payment or refund was changed.")).toBeVisible();
    await clientPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(clientPage.getByText("Support update: Information needed from client.")).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).last().click();
    await expect(page.getByText("Information needed for support review")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`linked-support-case-${width}.png`), fullPage: true });
    await clientPage.close();
  });
}

test("a queue refresh failure keeps the loaded case and recovers without reloading", async ({ page, context }) => {
  const state = await setup(context);
  state.opened = true;
  await page.clock.install();
  await page.goto("/__dispute-admin-journey?role=admin");
  await expect(page.getByRole("button", { name: "Review case" })).toBeVisible();
  state.failQueue = true;
  await page.clock.fastForward(16_000);
  await expect(page.getByRole("alert")).toContainText("Support cases could not be loaded. Try refreshing.");
  await expect(page.getByRole("button", { name: "Review case" })).toBeVisible();
  await expect(page.getByText("Private database diagnostics")).toHaveCount(0);
  state.failQueue = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review case" })).toBeVisible();
});

for (const role of ["client", "provider"] as const) {
  for (const width of [390, 768, 1024, 1280, 1440]) {
    test(`${role} can find and view their support case at ${width}px`, async ({ page, context }, testInfo) => {
      const state = await setup(context, role);
      state.opened = true;
      state.followup = true;
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/__dispute-admin-journey?role=participant-${role}`);
      const nav = width < 881 ? page.getByRole("navigation", { name: "Mobile dashboard navigation" })
        : page.getByRole("navigation", { name: "Dashboard navigation", exact: true });
      await nav.getByRole("button", { name: width < 881 ? "Support cases tab" : "Support cases", exact: true }).click();
      await expect(page).toHaveURL(/\/support-cases$/);
      await expect(page.getByRole("heading", { name: "Support cases", exact: true })).toBeVisible();
      await expect(page.getByText(role === "client" ? "Provider: Case Provider" : "Client: Case Client")).toBeVisible();
      await page.getByRole("button", { name: "View support case" }).click();
      expect(new URL(page.url()).searchParams.get("case")).toBe(caseId);
      await expect(page.getByText(`Case reference: ${caseId}`)).toBeVisible();
      await expect(page.getByText("Support update: Information needed from client.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Message client" })).toHaveCount(role === "provider" ? 1 : 0);
      await expect(page.getByRole("button", { name: "Record follow-up" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Approve full refund" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Request refund review" })).toHaveCount(role === "client" ? 1 : 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${role}-support-cases-${width}.png`), fullPage: true });
    });
  }
}

test("a closed participant case remains discoverable and cannot request another refund", async ({ page, context }) => {
  const state = await setup(context);
  state.opened = true;
  state.closed = true;
  await page.goto("/__dispute-admin-journey?role=participant-client&status=closed");
  await expect(page.getByText("This support case is closed.")).toBeVisible();
  await page.getByRole("button", { name: "View support case" }).click();
  await expect(page.getByText(`Case reference: ${caseId}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Request refund review" })).toHaveCount(0);
});

test("a signed-in client can navigate to their existing live support cases", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Sign in$/ }).first().click();
  await page.getByLabel("Email").fill("demo.user@giglink.test");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.locator("form").getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toHaveCount(0, { timeout: 20_000 });
  await page.goto("/bookings");
  await page.getByRole("navigation", { name: "Dashboard navigation", exact: true }).getByRole("button", { name: "Support cases", exact: true }).click();
  await expect(page).toHaveURL(/\/support-cases$/);
  await expect(page.getByRole("heading", { name: "Support cases", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View support case" }).first().click();
  await expect(page.getByRole("heading", { name: "Case progress and next steps" })).toBeVisible();
  await expect(page.getByText(/Support update:/).first()).toBeVisible();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Case progress and next steps" })).toBeVisible();
});
