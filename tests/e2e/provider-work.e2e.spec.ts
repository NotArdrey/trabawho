import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__provider-journey*", async (route) => {
    await route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script>
      </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/provider-work-journey.tsx"></script></body></html>` });
  });
  await page.route("**/src/shared/components/DashboardNavigation.tsx*", async (route) => { await route.fulfill({ contentType: "application/javascript", body: "export default function Navigation() { return null; }" }); });
  await page.route("**/src/features/bookings/hooks/useBookingActivity.ts*", async (route) => { await route.fulfill({ contentType: "application/javascript", body: "export function useBookingActivity() {}" }); });
  await page.route("**/src/features/work/hooks/useProviderDashboard.ts*", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: `export function useProviderDashboard() { return { isLoading: false, error: '', refresh() {}, snapshot: {
      providerName: 'Jose', hasProviderSetup: true, metrics: [{ id: 'inquiries', label: 'Open inquiries', value: '1', detail: 'Waiting for your response' }, { id: 'messages', label: 'Unread messages', value: '1', detail: 'Client message' }],
      actions: [
        { id: 'message-1', priority: 3, title: 'Unread client message', detail: 'Hello from Ana', conversationId: 'chat-1', destination: 'messages' },
        { id: 'booking-1', priority: 5, title: 'Active booking update', detail: 'Reservation Expired', bookingId: 'expired-1', destination: 'bookings' },
        { id: 'refund-1', priority: 1, title: 'Review refund request', detail: 'Ana', bookingId: 'refund-1', destination: 'work', workSection: 'refunds' },
      ],
      todaySchedule: [], nextAppointment: null, serviceHealth: { activeListings: 1, totalListings: 1, availableSlots: 1, rating: null, reviewCount: 0 }
    }}; }` });
  });
  await page.route("**/src/features/bookings/services/bookingService.js*", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: `let reads = 0;
      export async function fetchSellerBookings() { return [{ id: 'chat-1', status: 'Chat' }]; }
      export async function fetchClientBookings() { return []; }
      export async function fetchBookingById() { return null; }
      export async function fetchConversationById() { return { sellerId: 'worker-1' }; }
      export async function fetchBookingMessages() { reads++; return [{ id: 'message-1', sender: 'client', type: 'text', content: 'Hello from Ana' }, ...(reads > 1 ? [{ id: 'message-2', sender: 'client', type: 'text', content: 'New incoming message' }] : [])]; }
      export async function sendBookingMessage() {} export async function submitBookingReview() {} export async function updateBookingWorkflow() {}
    ` });
  });
  await page.route("**/src/features/work/services/workDeletion.ts*", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: `export async function deleteWorkService() { await new Promise(resolve => setTimeout(resolve, 150)); }
      export async function deleteWorkSlot() { await new Promise(resolve => setTimeout(resolve, 150)); }` });
  });
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`provider unread link opens incoming chat at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/__provider-journey");
    await page.getByRole("button", { name: /Unread client message/ }).click();
    await expect(page).toHaveURL(/messages\/chat-1\?scope=incoming/);
    await expect(page.getByRole("heading", { name: "Incoming chats" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Incoming messages" }).getByText("Hello from Ana")).toBeVisible();
    await expect(page.getByText("New incoming message")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`provider quick links preserve the booking and work queue at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/__provider-journey");
    await page.getByRole("button", { name: "Open incoming bookings" }).click();
    await expect(page).toHaveURL(/worker\/bookings\?scope=incoming&filter=inquiries/);

    await page.goto("/__provider-journey");
    await page.getByRole("button", { name: /Active booking update/ }).click();
    await expect(page).toHaveURL(/worker\/bookings\?scope=incoming&filter=all&q=expired-1/);

    await page.goto("/__provider-journey");
    await page.getByRole("button", { name: /Review refund request/ }).click();
    await expect(page).toHaveURL(/work\?section=refunds&booking=refund-1/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("message summary opens the incoming inbox", async ({ page }) => {
  await page.goto("/__provider-journey");
  await page.getByRole("button", { name: "Open client messages" }).click();
  await expect(page).toHaveURL(/messages\?scope=incoming/);
  await expect(page.getByText("Client conversation: chat-1")).toBeVisible();
});

for (const mode of ["calendar", "slots"]) {
  test(`My Work confirms service and ${mode} deletion with keyboard cancellation`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/__provider-journey?delete=1&mode=${mode}`);
    const trigger = page.getByRole("button", { name: "Delete service", exact: true });
    await trigger.click();
    await expect(page.getByRole("alertdialog")).toContainText("Plumbing");
    await page.getByRole("button", { name: "Cancel", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toBeFocused();
    await expect(page.getByText("Service deleted", { exact: true })).toHaveCount(0);
    await trigger.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete service", exact: true }).click();
    await expect(page.getByText("Service deleted", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete availability" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(mode === "calendar" ? "2026-10-05" : "09:00-10:00");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("Availability deleted", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Delete availability" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Availability deleted", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
