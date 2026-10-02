import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__assistant-journey", async (route) => {
    await route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
      </script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/assistant-journey.tsx"></script></body></html>` });
  });
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`formats replies, sends a photo, and follows up without resending it at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const calls: { attachments: unknown[]; messages: { attachments?: unknown[] }[] }[] = [];
    await page.route("**/functions/v1/trabawho-chatbot", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type" }, body: "ok" });
        return;
      }
      calls.push(route.request().postDataJSON() as typeof calls[number]);
      await route.fulfill({ json: { message: calls.length === 1 ? "Use **My Bookings**.\n\n1. Open **My Bookings**.\n2. Tap **Request Refund**." : "This image shows a **logo**." } });
    });
    await page.goto("/__assistant-journey");
    const reveal = page.getByRole("button", { name: /show trabawho assistant button/i });
    if (await reveal.isVisible()) await reveal.click();
    await page.getByRole("button", { name: /open trabawho assistant/i }).click();
    const input = page.getByRole("textbox", { name: /message trabawho assistant/i });
    const send = page.getByRole("button", { name: /^send message$/i });
    await input.fill("How can I request a refund?");
    await send.click();
    const reply = page.getByTestId("chatbot-message-assistant").last();
    await expect(reply.getByRole("listitem")).toHaveCount(2);
    await expect(reply.locator("strong").first()).toHaveText("My Bookings");
    await expect(reply).not.toContainText("**");
    await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=", "base64") });
    await expect(page.getByRole("button", { name: "Remove uploaded photo" })).toBeVisible();
    await input.fill("What is this image?");
    await send.click();
    await expect(reply).toContainText("This image shows a logo.");
    expect(calls[1].attachments).toHaveLength(1);
    await input.fill("Thanks for explaining");
    await send.click();
    await expect(page.getByTestId("chatbot-message-assistant")).toHaveCount(4);
    expect(calls[2].attachments).toEqual([]);
    expect(calls[2].messages.every((message) => !message.attachments)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
