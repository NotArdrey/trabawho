import { expect, test } from "@playwright/test";

const caseId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
test.beforeEach(async ({ page }) => {
  await page.route("**/__case-conversation*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/case-conversation-journey.tsx"></script></body></html>` }));
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`provider can preview and reply to support at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const messages: Array<Record<string, unknown>> = [];
    await page.route("**/rest/v1/booking_case_messages?*", (route) => route.fulfill({ json: messages }));
    await page.route("**/rest/v1/booking_case_notifications?*", (route) => route.fulfill({ json: [] }));
    await page.route("**/rest/v1/booking_case_replacement_visits?*", (route) => route.fulfill({ json: [] }));
    await page.route("**/rest/v1/rpc/send_booking_case_message", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body.p_case_id).toBe(caseId);
      expect(body.p_audience).toBe("admin");
      messages.push({ id: "message-1", case_id: caseId, author_id: "provider-1", author_role: "provider", audience: "admin",
        body: body.p_body, storage_path: null, operation_id: body.p_operation_id, created_at: "2026-10-03T08:00:00Z" });
      await route.fulfill({ json: messages[0] });
    });
    await page.goto("/__case-conversation?role=provider");
    await expect(page.getByRole("heading", { name: "Case conversation" })).toBeVisible();
    const send = page.getByRole("button", { name: "Send update" });
    await expect(send).toBeDisabled();
    await page.getByRole("textbox", { name: "Message" }).fill("I arrived at the service address and tried to contact the client.");
    await expect(send).toBeDisabled();
    await page.getByRole("button", { name: "Preview update" }).click();
    await expect(page.getByText("Preview · To support")).toBeVisible();
    await send.click();
    await expect(page.locator("ol li").getByText("I arrived at the service address and tried to contact the client.")).toBeVisible();
    expect(messages).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
