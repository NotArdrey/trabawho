import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__provider-quote-chat*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/provider-quote-chat-journey.tsx"></script></body></html>` }));
  await page.route("**/src/features/bookings/hooks/useBookingConversation.ts*", (route) => route.fulfill({
    contentType: "application/javascript", body: `export function useBookingConversation() { return {
      messages: [], setMessages() {}, isLoading: false, isSending: false, messageError: '',
      async send() { return true; }
    }; }`,
  }));
});

for (const width of [390, 768, 1280]) {
  test(`provider opens and closes a quote inside Messages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/__provider-quote-chat");
    const action = page.getByRole("button", { name: "Create quote" });
    await expect(action).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Quote editor" })).toHaveCount(0);

    await action.click();
    await expect(page.getByRole("region", { name: "Quote editor" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`provider-quote-inline-${width}.png`) });
    await page.getByRole("button", { name: "Close quote editor" }).click();
    await expect(page.getByRole("region", { name: "Quote editor" })).toHaveCount(0);
    await expect(action).toBeFocused();

    await action.click();
    await page.getByRole("spinbutton", { name: "Service price (PHP)" }).fill("950");
    await page.getByRole("textbox", { name: "Included work" }).fill("Garden cleanup and trimming");
    await page.getByLabel("Starts (PHT)").fill("2099-10-06T10:00");
    await page.getByLabel("Ends (PHT)").fill("2099-10-06T11:00");
    await page.getByRole("button", { name: "Review quote" }).click();
    await page.getByRole("button", { name: "Send quote" }).click();
    await expect(page.getByRole("heading", { name: "Provider quote" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Quote editor" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("one quote action is shown with ten booking conversations", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto("/__provider-quote-chat?many");
  await expect(page.getByRole("button", { name: "Create quote" })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Provider quote actions" })).toHaveCount(1);
});

test("a standalone message thread does not expose a quote that cannot be sent", async ({ page }) => {
  await page.goto("/__provider-quote-chat?standalone");
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create quote" })).toHaveCount(0);
});

test("an expired unpaid reservation lets the provider send a fresh quote", async ({ page }) => {
  await page.goto("/__provider-quote-chat?expired");
  await expect(page.getByText(/previous reservation expired/)).toBeVisible();
  await page.getByRole("button", { name: "Create quote" }).click();
  await page.getByRole("spinbutton", { name: "Service price (PHP)" }).fill("950");
  await page.getByRole("textbox", { name: "Included work" }).fill("A new garden cleanup appointment");
  await page.getByLabel("Starts (PHT)").fill("2099-10-06T10:00");
  await page.getByLabel("Ends (PHT)").fill("2099-10-06T11:00");
  await page.getByRole("button", { name: "Review quote" }).click();
  await page.getByRole("button", { name: "Send quote" }).click();
  await expect(page.getByRole("heading", { name: "Provider quote" })).toBeVisible();
});

test("quote action stays singular as the chat rerenders", async ({ page }) => {
  const duplicateKeyWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("same key")) duplicateKeyWarnings.push(message.text());
  });
  await page.goto("/__provider-quote-chat?rerender");
  await expect.poll(async () => Number(await page.locator("main").getAttribute("data-render-tick"))).toBeGreaterThan(6);
  await expect(page.getByRole("button", { name: "Create quote" })).toHaveCount(1);
  expect(duplicateKeyWarnings).toEqual([]);
});
