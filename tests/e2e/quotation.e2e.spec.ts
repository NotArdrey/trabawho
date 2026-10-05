import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/__quotation-journey", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    </head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/quotation-journey.tsx"></script></body></html>` }));
});

async function sendQuote(page: Page) {
  await page.getByRole("spinbutton", { name: "Service price (PHP)" }).fill("950");
  await page.getByRole("textbox", { name: "Included work" }).fill("Garden cleanup and trimming");
  await page.getByLabel("Starts (PHT)").fill("2099-10-06T10:00");
  await page.getByLabel("Ends (PHT)").fill("2099-10-06T11:00");
  await page.getByRole("button", { name: "Review quote" }).click();
  await expect(page.getByText("PHP 950.00").first()).toBeVisible();
  await page.getByRole("button", { name: "Send quote" }).click();
}

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`quote change request, revision, and verified payment at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/__quotation-journey");
    await sendQuote(page);
    await page.getByRole("button", { name: "Request changes" }).click();
    await page.getByRole("textbox", { name: "What should change?" }).fill("Start later, please.");
    await page.getByRole("button", { name: "Send change request" }).click();
    await expect(page.getByText("Client requested:")).toBeVisible();
    await sendQuote(page);
    await expect(page.getByText("Offer 2 · Price and schedule together")).toBeVisible();
    await page.getByRole("button", { name: "Accept and continue to payment" }).click();
    await expect(page.getByText("Payment pending")).toBeVisible();
    await page.getByRole("button", { name: "Simulate verified payment" }).click();
    await expect(page.getByText("Visit confirmed")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("declining a quote confirms and closes the request", async ({ page }) => {
  await page.goto("/__quotation-journey");
  await sendQuote(page);
  await page.getByRole("button", { name: "Decline quote" }).click();
  await expect(page.getByText(/ends the unpaid booking request/)).toBeVisible();
  await page.getByRole("button", { name: "Decline and close" }).click();
  await expect(page.getByRole("status")).toHaveText("Request closed");
  await expect(page.getByRole("button", { name: "Review quote" })).toHaveCount(0);
});
