import { expect, test } from "@playwright/test";
import { checkoutSessionId, fillSandboxCard, submitSandboxCheckout,
  sandboxSessionPaid, submitSandboxCheckoutAndWaitForReturn, verifySandboxCheckout } from "../../scripts/paymongo-sandbox-checkout.ts";

test("rejects a non-PayMongo or non-test checkout before card entry", async () => {
  expect(() => checkoutSessionId("https://example.com/cs_abc123")).toThrow(/Only PayMongo/);
  await expect(verifySandboxCheckout("https://checkout.paymongo.com/cs_abc123", "sk_live_secret"))
    .rejects.toThrow(/Live keys are never accepted/);
  const request = () => Promise.resolve(new Response(JSON.stringify({ data: { attributes: { livemode: true } } }), { status: 200 }));
  await expect(verifySandboxCheckout("https://checkout.paymongo.com/cs_abc123", "sk_test_secret", undefined, request))
    .rejects.toThrow(/not confirmed as PayMongo test mode/);
});

test("accepts an opaque v2 link only with its provider session ID and matching provider URL", async () => {
  const checkoutUrl = "https://checkout.paymongo.com/opaque-checkout-token#public-key";
  expect(() => checkoutSessionId(checkoutUrl)).toThrow(/did not provide a checkout session ID/);
  expect(checkoutSessionId(checkoutUrl, "cs_checkout123")).toBe("cs_checkout123");
  const request = (input: string | URL | Request) => {
    expect(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
      .toBe("https://api.paymongo.com/v1/checkout_sessions/cs_checkout123");
    return Promise.resolve(new Response(JSON.stringify({ data: { id: "cs_checkout123", attributes: {
      livemode: false, checkout_url: checkoutUrl,
    } } }), { status: 200 }));
  };
  await expect(verifySandboxCheckout(checkoutUrl, "sk_test_secret", "cs_checkout123", request)).resolves.toBeUndefined();
  await expect(verifySandboxCheckout(`${checkoutUrl}-different`, "sk_test_secret", "cs_checkout123", request))
    .rejects.toThrow(/different checkout session/);
});

test("recovers only a paid matching test checkout after a missing browser return", async () => {
  const input = { amount: 551, attemptId: "attempt-1", checkoutSessionId: "cs_test123",
    checkoutUrl: "https://checkout.paymongo.com/opaque", currency: "PHP", kind: "booking" as const,
    secret: "sk_test_secret" };
  const attributes = { checkout_url: input.checkoutUrl, livemode: false,
    metadata: { payment_attempt_id: input.attemptId },
    payments: [{ id: "pay_test123", attributes: { status: "paid", amount: 55100, currency: "PHP" } }] };
  const response = (value: typeof attributes) => () => Promise.resolve(new Response(JSON.stringify({
    data: { id: input.checkoutSessionId, attributes: value },
  }), { status: 200 }));
  expect(await sandboxSessionPaid(input, response(attributes))).toBe(true);
  expect(await sandboxSessionPaid(input, response({ ...attributes,
    metadata: { payment_attempt_id: "another-attempt" } }))).toBe(false);
  expect(await sandboxSessionPaid(input, response({ ...attributes, livemode: true }))).toBe(false);
});

test("rejects a non-local origin before trying to access the sandbox key", async ({ request }) => {
  const response = await request.post("/__trabawho_paymongo_sandbox_checkout", {
    headers: { Origin: "https://untrusted.example" },
    data: { checkoutUrl: "https://checkout.paymongo.com/cs_abc123" },
  });
  expect(response.status()).toBe(403);
});

for (const payment of ["booking deposit", "booking balance", "gig boost"]) {
  test(`fills and submits a verified ${payment} test checkout without bypassing PayMongo`, async ({ page }) => {
    const sessionId = payment === "gig boost" ? "cs_boost123" : payment === "booking balance" ? "cs_balance123" : "cs_deposit123";
    const request = (input: string | URL | Request) => {
      expect(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
        .toBe(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`);
      return Promise.resolve(new Response(JSON.stringify({ data: { id: sessionId, attributes: {
        livemode: false, checkout_url: `https://checkout.paymongo.com/${sessionId}`,
      } } }), { status: 200 }));
    };
    await verifySandboxCheckout(`https://checkout.paymongo.com/${sessionId}`, "sk_test_secret", undefined, request);
    await page.setContent(`<main><h1>PayMongo test checkout</h1>
      <label>Card number <input autocomplete="cc-number"></label>
      <label>Expiry <input autocomplete="cc-exp"></label>
      <label>CVC <input autocomplete="cc-csc"></label>
      <label>Cardholder name <input autocomplete="cc-name"></label>
      <label>Email <input type="email"></label>
      <label>Phone <input type="tel"></label>
      <button type="submit" onclick="document.body.dataset.submitted='yes'">Pay now</button></main>`);
    await fillSandboxCard(page);
    await expect(page.locator('input[autocomplete="cc-number"]')).toHaveValue("4343434343434345");
    await expect(page.locator('input[autocomplete="cc-exp"]')).toHaveValue("12/30");
    await expect(page.locator('input[autocomplete="cc-csc"]')).toHaveValue("123");
    await submitSandboxCheckout(page);
    expect(await page.locator("body").getAttribute("data-submitted")).toBe("yes");
  });
}

test("advances from PayMongo's card choice and fills only missing customer fields", async ({ page }) => {
  await page.setContent(`<main>
    <section id="method"><button type="button" onclick="document.querySelector('#continue').disabled=false">Card</button>
      <button id="continue" type="button" disabled onclick="setTimeout(()=>{document.querySelector('#method').hidden=true;document.querySelector('#form').hidden=false},250)">Continue</button></section>
    <section id="form" hidden>
      <label>Name <input value="Existing Customer"></label>
      <label>Email <input type="email" value="existing@example.com"></label>
      <label>Country <select><option value="">Select a country</option><option value="PH">Philippines</option></select></label>
      <label>Address Line 1 <input value="Existing address"></label>
      <label>City <input value="Malolos"></label>
      <label>State / Province <input value="Bulacan"></label>
      <label>Postal Code <input placeholder="12345"></label>
      <label>Card Number <input placeholder="1234 1234 1234 1234"></label>
      <label>MM <input placeholder="01"></label><label>YY <input placeholder="31"></label>
      <label>CVC <input placeholder="123"></label><label>Full Name <input placeholder="John Doe"></label>
      <button type="submit" onclick="document.body.dataset.submitted='yes'">Pay ₱551.00</button>
    </section></main>`);
  await fillSandboxCard(page);
  await expect(page.getByLabel("Card Number")).toHaveValue("4343434343434345");
  await expect(page.getByLabel("MM")).toHaveValue("12");
  await expect(page.getByLabel("YY")).toHaveValue("30");
  await expect(page.getByLabel("CVC")).toHaveValue("123");
  await expect(page.getByLabel("Postal Code")).toHaveValue("1000");
  await expect(page.getByLabel("Country")).toHaveValue("PH");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Existing Customer");
  await expect(page.getByLabel("Email")).toHaveValue("existing@example.com");
  await submitSandboxCheckout(page);
  expect(await page.locator("body").getAttribute("data-submitted")).toBe("yes");
});

test("waits for hydrated billing fields before advancing to the card form", async ({ page }) => {
  await page.setContent(`<main><p>Loading checkout...</p></main>`);
  await page.evaluate(() => {
    setTimeout(() => {
      document.querySelector("main")!.innerHTML = `<label>Email <input type="email" oninput="document.querySelector('#continue').disabled=!this.value"></label>
        <button type="button">Card</button>
        <button id="continue" type="button" disabled onclick="document.querySelector('#card').hidden=false">Continue</button>
        <section id="card" hidden><label>Card number <input autocomplete="cc-number"></label>
        <label>Expiry <input autocomplete="cc-exp"></label><label>CVC <input autocomplete="cc-csc"></label></section>`;
    }, 300);
  });
  await fillSandboxCard(page);
  await expect(page.getByLabel("Email")).toHaveValue("paymongo-test@example.com");
  await expect(page.getByLabel("Card number")).toHaveValue("4343434343434345");
});

test("captures the payment return before the isolated browser is redirected to sign-in", async ({ page }) => {
  await page.route("**/bookings?payment=verifying*", (route) => route.fulfill({ status: 302, headers: { Location: "/login" } }));
  await page.route("**/login", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Sign in</h1>" }));
  await page.goto("/__paymongo-test-return");
  await page.setContent(`<button type="submit" onclick="location.href='/bookings?payment=verifying&booking=booking-1&attempt=attempt-1'">Pay now</button>`);
  const returnUrl = await submitSandboxCheckoutAndWaitForReturn(page);
  expect(new URL(returnUrl).pathname).toBe("/bookings");
  expect(new URL(returnUrl).searchParams.get("attempt")).toBe("attempt-1");
});
