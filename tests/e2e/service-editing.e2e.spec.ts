import { expect, test, type Page } from "@playwright/test";

async function mockPaymentPreferences(page: Page) {
  const preferences = { user_id: "worker-1", payment_advance: false, payment_after_service: true, after_service_payment_type: "both", gcash_number: null as string | null };
  const writes: object[] = [];
  await page.route("**/rest/v1/worker_profiles?**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("user_id")).toBe("eq.worker-1");
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON() as Partial<typeof preferences>;
      writes.push(payload); Object.assign(preferences, payload);
    }
    await route.fulfill({ json: preferences });
  });
  // Fail loudly if preference writes regress to the public seller table.
  await page.route("**/rest/v1/sellers?**", (route) => route.fulfill({ status: 400, json: { code: "42703", message: "column sellers.payment_advance does not exist" } }));
  return { preferences, writes };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/__service-journey", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    </script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/service-editing-journey.tsx"></script></body></html>` }));
});

test("editing either listing persists after reload without changing the other listing", async ({ page }) => {
  const rows = [
    { id: 7, seller_id: "worker-1", title: "Appliance repair", short_description: "Repairs appliances", description: "Repairs appliances", base_price: 850, price_type: "fixed", duration_minutes: 45, metadata: { rate_basis: "per-project", booking_mode: "calendar-only" } },
    { id: 8, seller_id: "worker-1", title: "Computer repair", short_description: "Repairs computers", description: "Repairs computers", base_price: 650, price_type: "fixed", duration_minutes: 90, metadata: { rate_basis: "per-project", booking_mode: "calendar-only" } },
  ];
  const writes: number[] = [];
  await page.route("**/__service-isolation", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    </script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/service-isolation-journey.tsx"></script></body></html>` }));
  await page.route("**/rest/v1/services?**", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get("seller_id")).toBe("eq.worker-1");
    const id = query.get("id");
    const index = rows.findIndex((row) => `eq.${row.id}` === id);
    if (route.request().method() === "PATCH") {
      expect(index).toBeGreaterThanOrEqual(0);
      writes.push(rows[index].id);
      rows[index] = { ...rows[index], ...route.request().postDataJSON() as object };
    }
    await route.fulfill({ json: id ? rows[index] : rows });
  });
  const payment = await mockPaymentPreferences(page);
  await page.goto("/__service-isolation");
  for (const [id, title, price] of [[7, "Appliance maintenance", "1000"], [8, "Laptop maintenance", "700"]] as const) {
    if (id === 8) {
      await page.getByLabel("Active service").click();
      await page.getByRole("option", { name: "Computer repair", exact: true }).click();
    }
    const untouched = structuredClone(rows.find((row) => row.id !== id));
    await page.getByRole("button", { name: "Edit service" }).click();
    await page.getByLabel("Service title").fill(title);
    await page.getByLabel("Service price (PHP)").fill(price);
    await page.getByLabel("Detailed description").fill(`${title} description`);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("GCash advance", { exact: true }).check();
    await page.getByLabel("After service", { exact: true }).uncheck();
    await page.getByLabel("GCash number").fill("09123456789");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(rows.find((row) => row.id !== id)).toEqual(untouched);
    await page.reload();
    if (id === 8) {
      await page.getByLabel("Active service").click();
      await page.getByRole("option", { name: title, exact: true }).click();
    }
    const summary = page.getByRole("region", { name: "Current service summary" });
    await expect(summary.getByRole("heading", { name: title })).toBeVisible();
    await expect(summary).toContainText(`PHP ${price}`);
    await expect(summary).toContainText(`${title} description`);
  }
  expect(writes).toEqual([7, 8]);
  expect(payment.writes).toHaveLength(2);
  await page.getByRole("button", { name: "Edit service" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("GCash advance", { exact: true })).toBeChecked();
  await expect(page.getByLabel("After service", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("GCash number")).toHaveValue("09123456789");
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`add and edit share listing fields and save the selected service at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: Record<string, unknown>[] = [];
    let saved: Record<string, unknown> = {};
    await page.route("**/rest/v1/services?**", async (route) => {
      expect(new URL(route.request().url()).searchParams.get("id")).toBe("eq.7");
      expect(new URL(route.request().url()).searchParams.get("seller_id")).toBe("eq.worker-1");
      if (route.request().method() === "PATCH") {
        const payload = route.request().postDataJSON() as Record<string, unknown>;
        writes.push(payload); saved = { ...saved, ...payload };
      }
      await route.fulfill({ json: saved });
    });
    const payment = await mockPaymentPreferences(page);
    await page.goto("/__service-journey");
    await page.getByLabel("Service title").fill("Laptop repair");
    await page.getByLabel("Short description").fill("Repairs laptops and desktops.");
    await page.getByLabel("Detailed description").fill("Includes diagnosis and repairs.");
    await page.getByLabel("Service price (PHP)").fill("650");
    await page.getByLabel("Estimated duration").fill("90");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: /^Request booking/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Publish service" }).click();
    saved = JSON.parse(await page.getByTestId("saved-service").innerText()) as Record<string, unknown>;
    await page.getByRole("button", { name: "Edit service" }).click();
    await expect(page.getByRole("dialog", { name: "Edit service" })).toBeVisible();
    await expect(page.getByLabel("Short description")).toHaveValue("Repairs laptops and desktops.");
    await expect(page.getByLabel("Estimated duration")).toHaveValue("90");
    await page.getByLabel("Service title").fill("Computer repair");
    await page.getByLabel("Pricing model").click();
    await page.getByRole("option", { name: "Monthly", exact: true }).click();
    await page.getByLabel("Monthly rate (PHP)").fill("1200");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("radio", { name: /^Request booking/ })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes).toHaveLength(1);
    expect(payment.writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ title: "Computer repair", short_description: "Repairs laptops and desktops.", duration_minutes: 90, base_price: 1200, metadata: { rate_basis: "per-month", ad_booster: { active: true } } });
    await page.getByRole("button", { name: "Edit service" }).click();
    await expect(page.getByLabel("Monthly rate (PHP)")).toHaveValue("1200");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit service" })).toBeFocused();
  });
}

test("reports partial saves and keeps edits available for retry when worker preferences fail", async ({ page }) => {
  let saved = { id: 7, seller_id: "worker-1", title: "Repair", short_description: "Appliance repair", description: "Appliance repair", base_price: 850, price_type: "fixed", duration_minutes: 45, metadata: { booking_mode: "calendar-only" } };
  await page.route("**/__service-isolation", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    </script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/service-isolation-journey.tsx"></script></body></html>` }));
  await page.route("**/rest/v1/services?**", async (route) => {
    if (route.request().method() === "PATCH") saved = { ...saved, ...route.request().postDataJSON() as object };
    await route.fulfill({ json: new URL(route.request().url()).searchParams.has("id") ? saved : [saved] });
  });
  await mockPaymentPreferences(page);
  let failPayment = true;
  await page.route("**/rest/v1/worker_profiles?**", async (route) => {
    if (route.request().method() !== "PATCH" || !failPayment) return route.fallback();
    await route.fulfill({ status: 400, json: { code: "42703", message: "private database diagnostic" } });
  });
  await page.goto("/__service-isolation");
  await page.getByRole("button", { name: "Edit service" }).click();
  await page.getByLabel("Service title").fill("Updated repair");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("Your listing was saved, but payment preferences could not be saved");
  await expect(page.getByRole("dialog")).toContainText("Updated repair");
  expect(saved.title).toBe("Updated repair");
  await expect(page.getByRole("dialog")).not.toContainText("private database diagnostic");
  failPayment = false;
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
