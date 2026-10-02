import { expect, test } from "@playwright/test";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "./helpers/supabase.js";

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`admin identity review decision remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    let status = "PENDING_REVIEW";
    const decisions: Record<string, unknown>[] = [];
    const review = () => ({ id: "review-1", user_id: "applicant-1", submitted_by_email: "identity-test@example.com", submitted_app_role: "client", document_type: "UMID", source: "MANUAL_UPLOAD", status,
      created_at: "2026-10-02T08:00:00Z", expected_decision_by: "2026-10-09T08:00:00Z", duplicate_reason: null, duplicate_match_count: 0, reviewed_at: null, review_notes: null, decision_email_sent_at: null,
      email_delivery_status: "pending", email_delivery_error: null, verified_full_legal_name: "Identity Test Applicant", didit_session_id: null });
    await page.route("**/functions/v1/admin-identity-review", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body.action === "list") return route.fulfill({ json: { success: true, items: body.status === status || body.status === "all" ? [review()] : [], total: 1, page: 1, pageSize: 20 } });
      if (body.action === "detail") return route.fulfill({ json: { success: true, review: review(), profile: { full_name: "Identity Test Applicant", email: "identity-test@example.com", role: "client", province: "La Union", city: "Balaoan", barangay: "Almeida", address: "12 Main Street", verification_status: status, id_document_expiry: "2030-01-01", account_status: "active", is_verified: false }, images: [], warnings: [], didit: null, history: status === "APPROVED" ? [{ id: "audit-1", decision: status, reason: "The document and selfie match the applicant.", created_at: "2026-10-02T09:00:00Z" }] : [] } });
      if (body.action === "decide") { decisions.push(body); status = "APPROVED"; return route.fulfill({ json: { success: true, status, emailDelivery: { sent: true, required: true, status: "sent" } } }); }
      return route.fulfill({ status: 400, json: { error: "Unexpected test action" } });
    });
    await page.goto("/");
    await page.getByRole("button", { name: /^Sign in$/ }).first().click();
    await page.getByLabel("Email").fill(DEMO_ADMIN_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await page.locator("form").getByRole("button", { name: /^Sign in$/ }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 20_000 });
    if (width < 881) await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("button", { name: "Identity reviews", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Identity reviews" })).toBeVisible();
    await page.getByRole("button", { name: "Review identity", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Identity review", exact: true });
    await expect(dialog.getByText(/12 Main Street, Almeida, Balaoan, La Union/)).toBeVisible();
    if (width === 390 || width === 1440) await page.screenshot({ path: test.info().outputPath('identity-review.png'), fullPage: true });
    await dialog.getByRole("button", { name: "Approve identity" }).click();
    await expect(dialog.getByRole("alert")).toContainText("20 to 2000");
    await dialog.getByLabel("Decision reason").fill("The document and selfie match the applicant.");
    await dialog.getByRole("button", { name: "Approve identity" }).click();
    await expect(dialog.getByRole("alert")).toContainText("reviewed the identity evidence");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Approve identity" }).click();
    expect(decisions).toHaveLength(0);
    await dialog.getByRole("button", { name: "Confirm approval" }).click();
    await expect(dialog.getByRole("status")).toContainText("confirm their email");
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ evidenceReviewed: true, decision: "APPROVED" });
    await dialog.getByRole("button", { name: "Close review" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
