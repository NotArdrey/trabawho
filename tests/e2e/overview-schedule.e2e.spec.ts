import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__overview-schedule*", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/overview-schedule-journey.tsx"></script></body></html>` }));
  await page.route("**/src/shared/components/DashboardNavigation.tsx*", (route) => route.fulfill({ contentType: "application/javascript", body: "export default function Navigation() { return null; }" }));
  await page.route("**/src/features/bookings/hooks/useBookingActivity.ts*", (route) => route.fulfill({ contentType: "application/javascript", body: "export function useBookingActivity() {}" }));
  await page.route("**/src/features/dashboard/services/clientDashboardService.ts*", (route) => route.fulfill({ contentType: "application/javascript", body: `export async function fetchClientOverviewSnapshot() { return {
    user: { id: 'client-1' }, unreadMessageCount: 0, conversations: [], messages: [],
    bookings: [
      { id: 'disputed-1', serviceType: 'Apartment cleaning', workerName: 'Maria', status: 'Dispute Open', activeReplacementStartAt: '2099-10-10T16:00:00+08:00', paymentProofSubmitted: true, raw: { booking: { start_ts: '2026-10-05T23:00:00+08:00', updated_at: '2026-10-06T10:00:00+08:00' } } },
      { id: 'cancelled-1', serviceType: 'Laundry', workerName: 'Carla', status: 'Cancelled', paymentProofSubmitted: true, raw: { booking: { start_ts: '2099-10-11T13:00:00+08:00', updated_at: '2026-10-06T11:00:00+08:00' } } },
      { id: 'due-1', serviceType: 'Garden work', workerName: 'Nina', status: 'Payment Pending', paymentStatus: 'unpaid', raw: { booking: { updated_at: '2026-10-01T10:00:00+08:00' } } },
    ],
  }; }` }));
  await page.route("**/src/features/dashboard/services/clientDashboardCases.ts*", (route) => route.fulfill({ contentType: "application/javascript", body: `export async function fetchClientOverviewCases() { return [{ id: 'case-1', bookingId: 'disputed-1', service: 'Apartment cleaning', status: 'under_review', resolution: 'awaiting_client', unreadCount: 1, updatedAt: '2026-10-06T10:00:00+08:00' }]; }` }));
  await page.route("**/src/features/work/hooks/useProviderDashboard.ts*", (route) => route.fulfill({ contentType: "application/javascript", body: `export function useProviderDashboard() { return { isLoading: false, error: '', refresh() {}, snapshot: {
    providerName: 'Maria', hasProviderSetup: true,
    metrics: [{ id: 'inquiries', label: 'Open inquiries', value: '0', detail: 'No requests waiting' }, { id: 'today', label: "Today's visits", value: '0', detail: 'No visits today' }, { id: 'messages', label: 'Unread messages', value: '0', detail: 'No unread messages' }, { id: 'earnings', label: 'Verified booking value', value: 'PHP 0', detail: '0 paid, undisputed bookings' }],
    actions: [], todaySchedule: [], nextAppointment: { id: 'disputed-1', bookingId: 'disputed-1', service: 'Apartment cleaning', client: 'Kuh', schedule: 'Oct 10, 4:00 PM PHT', status: 'Replacement visit confirmed' },
    serviceHealth: { activeListings: 1, totalListings: 1, availableSlots: 1, rating: null, reviewCount: 0 },
    serviceListings: [{ id: 11, title: 'Apartment cleaning', description: 'Tidy apartments and shared spaces', bookingType: 'Time-slot booking', availableSlots: 1, nextOpenAt: 'Oct 10, 4:00 PM PHT' }]
  }}; }` }));
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`client overview shows the current visit and honest updates at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/__overview-schedule");
    const next = page.getByRole("region", { name: "Your next services" });
    await expect(next.getByRole("link", { name: /Open Apartment cleaning booking with Maria/ })).toContainText("Oct 10, 4:00 PM PHT");
    await expect(next).not.toContainText("Oct 5");
    await expect(next).toContainText("Support case open");
    await expect(next.getByRole("button", { name: "View all bookings" }).first()).toHaveClass(/bg-primary/);
    const recent = page.getByRole("region", { name: "Recent updates" });
    await expect(recent).not.toContainText("Payment proof received");
    await expect(recent.locator("header")).toHaveClass(/bg-primary/);
    await expect(recent.locator("li").first()).toContainText("Booking cancelled");
    const steps = page.getByRole("region", { name: "Your next steps" });
    await expect(steps.getByRole("link", { name: /Complete booking payment/ })).toHaveAttribute("href", "/bookings?scope=purchases&filter=all&q=due-1&focus=due-1");
    await expect(steps.getByRole("link", { name: /Reply to support/ })).toHaveAttribute("href", "/support-cases?case=case-1#case-conversation");
    if (width === 390 || width === 1280) await page.screenshot({ path: `test-results/overview-client-${width}.png`, fullPage: true });
    await next.getByRole("link", { name: /Open Apartment cleaning booking with Maria/ }).click();
    await expect(page).toHaveURL(/\/bookings\?scope=purchases&filter=all&q=disputed-1&focus=disputed-1/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`provider overview identifies the replacement visit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/__overview-schedule?mode=provider");
    const schedule = page.getByRole("region", { name: "Today's schedule" });
    await expect(schedule).toContainText("No visits today");
    await expect(schedule).toContainText("Next appointment");
    await expect(schedule).toContainText("Oct 10, 4:00 PM PHT");
    await expect(schedule).toContainText("Replacement visit confirmed");
    const services = page.getByRole("region", { name: "Your services" });
    await expect(services).toContainText("Active listings");
    await expect(services).toContainText("Published reviews");
    await expect(services.getByRole("list", { name: "Active service listings" })).toContainText("Apartment cleaning");
    await expect(services.getByRole("list", { name: "Active service listings" })).toContainText("Next: Oct 10, 4:00 PM PHT");
    await expect(services).not.toContainText("Service health");
    if (width === 390 || width === 1280) await page.screenshot({ path: `test-results/overview-provider-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
