import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__archive-journey*", async (route) => {
    await route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
      </script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/chat-archive-journey.tsx"></script></body></html>` });
  });
  // Keep browser journeys deterministic without changing a real user's conversations.
  await page.route("**/src/features/bookings/services/chatArchive.ts*", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: `
      let restored = false;
      export async function fetchArchivedChats() {
        return restored ? [] : [{ id: 'conversation:chat-1', conversationId: 'chat-1', workerName: 'Juan Provider', clientName: 'Ana Client', serviceType: 'Plumbing' }];
      }
      export async function unarchiveChat() { await new Promise(resolve => setTimeout(resolve, 100)); restored = true; }
    ` });
  });
  await page.route("**/src/features/bookings/hooks/useBookingConversation.ts*", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: `
      export function useBookingConversation() { return {
        messages: [{ id: 'message-1', sender: 'worker', type: 'text', content: 'Your appointment is confirmed.', timestamp: '10:00 AM' }],
        setMessages() {}, isLoading: false, isSending: false, messageError: '', async send() { return true; }
      }; }
    ` });
  });
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`browse archived history and unarchive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/__archive-journey");
    const trigger = page.getByRole("button", { name: "Archived chats", exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/inbox=archived/);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.getByRole("searchbox", { name: "Search archived chats" }).fill("tutor");
    await expect(page.getByText("No archived chats match your search.")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search archived chats" }).fill("plumbing");
    await page.getByRole("button", { name: /Juan Provider/ }).click();
    await expect(page.getByRole("region", { name: "Archived messages" }).getByText("Your appointment is confirmed.")).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds && bounds.width <= width).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`archive-${width}.png`) });
    await page.getByRole("button", { name: "Unarchive chat" }).click();
    await expect(page.getByText(/Chat unarchived/)).toBeVisible();
    await expect(page.getByText(/No archived chats\. Chats you archive/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByText("Active inbox refreshed")).toBeVisible();
  });
}

test("archive access stays available when the active inbox is empty", async ({ page }) => {
  await page.goto("/__archive-journey?empty=true&role=seller&inbox=archived");
  await page.getByRole("button", { name: /Ana Client/ }).click();
  await expect(page.getByRole("heading", { name: "Ana Client" })).toBeVisible();
  await page.getByRole("button", { name: "Unarchive chat" }).click();
  await expect(page.getByText(/No archived chats\. Chats you archive/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Active inbox refreshed")).toBeVisible();
});

test("archiving the last conversation keeps its history reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/__archive-journey");
  await page.getByRole("button", { name: /Juan Provider/ }).click();
  await page.getByRole("button", { name: "Conversation actions" }).click();
  await page.getByRole("button", { name: "Archive Chat", exact: true }).click();
  await page.getByRole("button", { name: "Archive Chat", exact: true }).click();
  await expect(page.getByText("No active conversations.")).toBeVisible();
  await page.getByRole("button", { name: "Archived chats", exact: true }).click();
  await page.getByRole("button", { name: /Juan Provider/ }).click();
  await expect(page.getByRole("region", { name: "Archived messages" }).getByText("Your appointment is confirmed.")).toBeVisible();
});
