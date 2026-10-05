import { expect, test } from "@playwright/test";

const caseId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
test.beforeEach(async ({ page }) => {
  await page.route("**/__refund-journey*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/dispute-refund-journey.tsx"></script></body></html>` }));
});
for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`client can request and track a dispute refund at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let requested = false;
    let approved = false;
    let succeeded = false;
    let requests = 0;
    await page.route("**/rest/v1/booking_support_cases?*", (route) => route.fulfill({ json: {
      id: caseId, case_type: "provider_no_show", reason: "The provider did not arrive for our appointment.", policy_route: "support_review",
      status: "under_review", refund_requested_at: requested ? new Date().toISOString() : null,
      latest_support_action: "refund_review_needed", latest_support_target: null,
    } }));
    await page.route("**/rest/v1/booking_refunds?*", (route) => route.fulfill({ json: approved ? [{ id: "refund-1", case_id: caseId,
      amount: 464, currency: "PHP", status: succeeded ? "succeeded" : "pending", provider_refund_id: "ref_verified", updated_at: new Date().toISOString() }] : [] }));
    await page.route("**/rest/v1/rpc/has_verified_refund_payment", (route) => route.fulfill({ json: true }));
    await page.route("**/rest/v1/rpc/request_booking_case_refund", async (route) => {
      requests++; requested = true;
      await route.fulfill({ json: {} });
    });
    await page.route("**/functions/v1/process-booking-refunds", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ caseId, action: "check" });
      succeeded = true;
      await route.fulfill({ json: { checked: true, needsRetry: false } });
    });
    await page.goto("/__refund-journey");
    await expect(page.getByText(/Support update: Referred for refund review/)).toBeVisible();
    await expect(page.getByText("Refund review", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Request refund review" }).click();
    await expect(page.getByText("Refund review requested. Waiting for support approval.")).toBeVisible();
    expect(requests).toBe(1);
    approved = true;
    await page.reload();
    await expect(page.getByText(/PHP 464.00.*Refund pending/)).toBeVisible();
    await page.getByRole("button", { name: "Check refund status" }).click();
    await expect(page.getByText(/Refund sent to original payment method/)).toBeVisible();
    await expect(page.getByText("Refund reference: ref_verified")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test("a paid booking without a provider-verified attempt does not offer refund review", async ({ page }) => {
  let paymentChecks = 0;
  await page.route("**/rest/v1/booking_support_cases?*", (route) => route.fulfill({ json: {
    id: caseId, case_type: "provider_no_show", reason: "The provider did not arrive.", status: "under_review",
    refund_requested_at: null, resolution_status: null,
  } }));
  await page.route("**/rest/v1/booking_refunds?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/rpc/has_verified_refund_payment", (route) => { paymentChecks++; return route.fulfill({ json: false }); });
  await page.goto("/__refund-journey");
  await expect.poll(() => paymentChecks).toBeGreaterThan(0);
  await expect(page.getByText("Refund review")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request refund review" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check refund status" })).toHaveCount(0);
});
test("provider cannot start work with an outstanding balance and stale paid label", async ({ page }) => {
  await page.goto("/__refund-journey?role=provider");
  await expect(page.getByText(/Do not begin until full payment is verified/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start work" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Submit delivery" })).toHaveCount(0);
});
test("admin refund requires an evidence reason and explicit confirmation", async ({ page }) => {
  let issued = false;
  let calls = 0;
  await page.route("**/rest/v1/booking_refunds?*", (route) => route.fulfill({ json: issued ? [{ id: "refund-1", case_id: caseId,
    amount: 464, currency: "PHP", status: "simulated", provider_refund_id: null, updated_at: new Date().toISOString() }] : [] }));
  await page.route("**/functions/v1/process-booking-refunds", async (route) => {
    const body: unknown = route.request().postDataJSON();
    expect(body).toEqual({ caseId, action: "approve", expectedAmount: 464, reason: "The provider did not attend the confirmed appointment." });
    issued = true; calls++;
    await route.fulfill({ json: { checked: true, needsRetry: false, simulatedCount: 1 } });
  });
  await page.goto("/__refund-journey?role=admin");
  await expect(page.getByRole("heading", { name: "Refund review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve test refund" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Refund approval reason" }).fill("The provider did not attend the confirmed appointment.");
  await page.getByRole("button", { name: "Approve test refund" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("PHP 464");
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Keep reviewing" }).click();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Approve test refund" }).click();
  await page.getByRole("button", { name: "Confirm test refund" }).click();
  await expect(page.getByText(/PHP 464.*Sandbox refund simulated/)).toBeVisible();
  expect(calls).toBe(1);
});
