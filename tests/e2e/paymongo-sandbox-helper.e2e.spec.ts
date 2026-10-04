import { expect, test } from "@playwright/test";
import { checkoutSessionId, fillSandboxCard, submitSandboxCheckout, verifySandboxCheckout } from "../../scripts/paymongo-sandbox-checkout.mts";

test("rejects a non-PayMongo or non-test checkout before card entry", async () => {
  expect(() => checkoutSessionId("https://example.com/cs_abc123")).toThrow(/Only PayMongo/);
  await expect(verifySandboxCheckout("https://checkout.paymongo.com/cs_abc123", "sk_live_secret"))
    .rejects.toThrow(/Live keys are never accepted/);
  const request = () => Promise.resolve(new Response(JSON.stringify({ data: { attributes: { livemode: true } } }), { status: 200 }));
  await expect(verifySandboxCheckout("https://checkout.paymongo.com/cs_abc123", "sk_test_secret", request))
    .rejects.toThrow(/not confirmed as PayMongo test mode/);
});

for (const payment of ["booking deposit", "booking balance", "gig boost"]) {
  test(`fills and submits a verified ${payment} test checkout without bypassing PayMongo`, async ({ page }) => {
    const sessionId = payment === "gig boost" ? "cs_boost123" : payment === "booking balance" ? "cs_balance123" : "cs_deposit123";
    const request = (input: string | URL | Request) => {
      expect(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
        .toBe(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`);
      return Promise.resolve(new Response(JSON.stringify({ data: { attributes: { livemode: false } } }), { status: 200 }));
    };
    await verifySandboxCheckout(`https://checkout.paymongo.com/${sessionId}`, "sk_test_secret", request);
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
