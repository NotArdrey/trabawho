# PayMongo

TrabaWho uses PayMongo Hosted Checkout v2 for the card sandbox flow. Checkout
sessions are created by a Supabase Edge Function, and payment is confirmed through a signed PayMongo webhook or an authenticated
server-side reconciliation against the provider API. Browser return parameters
never confirm payment.

## Credential boundary

Store these as Supabase Edge Function secrets:

```text
PAYMONGO_SECRET_KEY
PAYMONGO_WEBHOOK_SECRET
TRABAWHO_APP_URL
```

For the demo, `PAYMONGO_SECRET_KEY` must be a test key and
`TRABAWHO_APP_URL` must be the application origin, without a trailing path. The
webhook signing secret is generated for the webhook endpoint in PayMongo's
developer dashboard. It is different from the PayMongo API secret key.

The hosted-checkout flow does not use the PayMongo public key. Never expose the
secret key through a `VITE_*` variable, source file, client request, screenshot,
documentation example, or commit.

For local tooling, the server-only test secret may be read from the ignored
`.env` as `PAYMONGO_SECRET_KEY`. Upload it as an Edge Function secret; restarting
Vite alone does not update the remote payment configuration. Checkout uses the
secret's environment, and the PayMongo API's `livemode` field verifies it. The
hosted page may omit a test-mode banner.

## Components

- `supabase/functions/create-paymongo-checkout/` authenticates the buyer,
  creates or reuses a database payment attempt, and creates a PayMongo Checkout
  Session.
- `supabase/functions/paymongo-webhook/` verifies the raw-body HMAC signature
  and records a paid checkout through a service-role-only RPC.
- `supabase/migrations/20260930090000_paymongo_checkout_foundation.sql` adds
  payment-attempt and provider-event records plus controlled RPCs.
- `supabase/migrations/20261001090000_transaction_safe_booking_holds.sql`
  atomically reserves capacity, aligns attempts to a 15-minute hold, and keeps
  late payments from reclaiming an expired schedule.
- `supabase/migrations/20261004090000_fix_checkout_attempt_retries.sql` resolves
  repeated operations through the audit event's attempt ID, including attempts
  reused from another operation. It rejects expired attempts and mismatched
  installment amounts, and retains the reused attempt's reservation deadline.
- `src/features/bookings/services/paymongoCheckout.ts` invokes checkout from the
  browser and validates the returned PayMongo URL.

## Deployment order

1. Rotate any test secret that was shared through an insecure channel.
2. Apply the PayMongo database migration.
3. Add the three Edge Function secrets in the Supabase project.
4. Deploy `create-paymongo-checkout` with normal JWT verification.
5. Deploy `paymongo-webhook` without Supabase JWT verification. PayMongo
   authenticates to this endpoint through its own HMAC signature.
6. Register the public webhook URL in PayMongo test mode for
   `checkout_session.payment.paid`. The reusable
   `scripts/register-paymongo-webhook.ps1` command registers or reuses the
   endpoint, stores its signing secret in Supabase, and verifies a signed
   diagnostic request without creating payment data.
7. If the endpoint signing secret is rotated in PayMongo, rerun that script to
   synchronize `PAYMONGO_WEBHOOK_SECRET`.
8. Send a PayMongo test event, then complete a sandbox card checkout.

Do not deploy the checkout function before the database migration. Do not
activate the client redirect before both functions are reachable.

## Verification checklist

### Faster QA checkout for bookings and gig boosts

The same test-only helper fills PayMongo's public successful test card for any
TrabaWho Hosted Checkout session, whether it came from a booking deposit,
booking balance, or gig boost:

```powershell
npm run paymongo:test-checkout -- "https://checkout.paymongo.com/cs_..."
```

Copy the checkout URL after starting payment in the app. The helper requires a
server-only `PAYMONGO_SECRET_KEY=sk_test_...` in the local ignored `.env` or
process environment. Before opening or filling the page, it retrieves that
session from PayMongo and refuses any session whose `livemode` is not `false`.
It then uses PayMongo's documented no-3DS test card, submits the hosted form,
and waits for the return to TrabaWho. No real card or money is used. If PayMongo
changes its hosted form, the helper stops and leaves manual checkout available.
It never marks a booking paid or activates a boost itself: the signed webhook
or server-side reconciliation still has to verify the provider outcome. Do not
use this helper with live keys or as a customer-facing "saved card" button.
Both checkout functions also send the payer's existing name, email, phone,
street, barangay, city, and province as billing prefill when available. This
applies only to **new** sessions after those Edge Functions are deployed;
opening an older checkout URL will not gain the prefill. TrabaWho does not
store a postal code, so PayMongo may still ask for it. Card details remain on
PayMongo's hosted page; this is not card vaulting or a reusable saved card.
The QA helper above is run locally with a checkout URL, not by clicking the
app's payment button. The boost return flow checks provider status
automatically and does not offer a separate "Check payment again" button.

- [PayMongo test mode and test cards](https://docs.paymongo.com/docs/payment-acceptance-testing)
- [Hosted Checkout test mode](https://docs.paymongo.com/docs/payment-channels-testing)


- The browser receives only `checkoutUrl`, `paymentAttemptId`, `bookingId`, and
  the server-generated `holdExpiresAt` timestamp.
- The checkout URL uses `https://checkout.paymongo.com`.
- Returning through `success_url` does not mark a booking paid by itself.
- A valid paid webhook confirms the correct installment once.
- Replaying the webhook remains idempotent.
- Invalid signatures return `401`.
- Amount, currency, or test/live mismatches do not confirm the booking.
- Closing the browser before redirect does not lose a payment confirmed by the
  webhook.
- Payment attempts and PayMongo sandbox records reconcile.

## Recovery

Sandbox verification completed after applying the retry migration and
synchronizing the API and webhook secrets: a PHP 650 service collected PHP
357.50 initially and PHP 325 for the balance. The final booking had PHP 682.50
paid, a PHP 32.50 platform fee, zero remaining balance, and a confirmed schedule.
Both provider sessions were test mode, and reused-attempt retries returned the
original payment attempt successfully.

Marketplace Message and inquiry actions open chat directly. Book now opens
schedule selection; payment amounts are reviewed next. Booking terms appear
only when continuing from that payment summary, with no demo-payment section.

New bookings use an 8% commission after migration
`20261004120000_booking_commission_eight_percent.sql`. Existing bookings retain
their agreed rate, including the historical sandbox example above. For a PHP
1,200 direct-slot booking, the fee is PHP 96. Initial checkout collects PHP 696
(PHP 600 deposit plus the entire platform fee); balance checkout collects PHP
600. Total payment is PHP 1,296, with no second
platform fee. Amounts are calculated in the database and converted to centavos
by the Edge Function; the browser does not submit a charge amount. Frontend
half-cent rounding follows the database's positive numeric rounding.

If a retry reports `Payment attempt could not be created`, check that the retry
migration is applied. The older RPC looked up reused attempts using the newer
operation ID, although the attempt retained its original ID. The resulting
empty payment attempt failed validation before reaching PayMongo.

Browser operation IDs distinguish schedule, quote version, payment purpose,
and plan. Retries retain an operation during its 15-minute window; expired
reservations require a fresh operation. GCash preview is removed from checkout.

If checkout creation fails, the booking remains payment-pending until its hold
expires and may be retried with the same browser operation ID. A paid webhook
received after expiry is marked for refund review and does not reclaim the
released slot. If webhook processing fails, leave
the booking pending, inspect function logs without printing secrets or raw
customer data, and reconcile the provider payment before any manual action.

## Paid gig boosts

`20261004110000_paid_service_ad_boosts.sql` adds owner-readable boost attempts,
a provider event ledger, checkout/activation RPCs, and protection against
browser-written boost metadata. Apply it before deploying
`create-paymongo-boost-checkout`, `reconcile-paymongo-boost-checkout`, and the
updated `paymongo-webhook`. These use the same server-only sandbox credentials
and signed webhook as bookings. Existing demo boosts retain their metadata
history but become inactive.

The entered budget is a single charge for all selected days, with no booking
commission added. The server validates whole durations from 1?365 days and a
PHP budget of at least 1 with at most two decimals. Retries reuse a pending
checkout for 15 minutes. A boost starts only after provider-verified payment;
its entire purchased duration starts at verification. A conflicting late
payment or inactive gig is recorded as `paid_needs_review` instead of replacing
another paid campaign. Amount, currency, environment, and checkout identity
must match before activation. Cancelling or refreshing checkout cannot activate
an unpaid campaign.

Marketplace discovery loads active gigs in batches, so ads older than the
previous newest-80 limit can still appear. Verified active campaigns receive
priority in recommendations; explicit price, rating, and newest sorts remain
in their requested order. Paid campaigns of equal priority use budget then
start time. The page recalculates expiry every 30 seconds. Existing category,
location, and search filters still apply; boosts do not guarantee bookings.

Actual sandbox verification collected PHP 250 once for seven days, kept the
gig inactive before payment, reused the same attempt on retry, and activated
exactly seven days after payment verification. Browser journeys cover summary,
consent, redirect, unpaid cancellation, and verified returns at the documented
responsive widths. `tests/integration/payment-boost.sql` runs database security,
amount, retry, duration, legacy commission, and 8% deposit assertions inside a
rolled-back transaction.

## Dispute refunds and payment protection (sandbox backend deployed)

The implementation includes two migrations, applied in order:

- `20261005100000_booking_case_refunds.sql`: client refund-review requests,
  participant-visible support progress, admin approvals, protected refund records,
  serialized submissions, and verified provider results.
- `20261005101000_guard_funded_work_and_verified_refunds.sql`: full numeric funding
  checks for work start, delivery, and completion, insert-time protection against
  fabricated financial state, and the verified refund transition.

Both migrations are applied to the TrabaWho demo/test project configured in `.env`
(`dczhfpcfqlygpbqjctwf`), and `process-booking-refunds` version 1 is active with JWT
verification enabled. The CLI dry run confirmed these were the only pending
migrations; no unrelated migrations were applied. The function uses the existing
server-only `PAYMONGO_SECRET_KEY` and intentionally accepts only a test secret.
No live refunds are enabled. Existing case history remains readable during staged
rollouts through the legacy-column fallback.

Clients request review from the booking card's **Refund review** section. Both
participants see the support next step, approved amounts, provider references,
and pending, sent, failed, or review-required states. Private admin reasons are
excluded from participant column grants. A referral still does not issue money.
Administrators use **Approve full refund** with a required reason and confirmation.
The server calculates each amount from verified payment attempts and rejects a
changed total after the admin confirmation, including any
collected platform fee. This is a discretionary sandbox remedy, not a production
cancellation or fee-refund policy. No unpaid balance is refunded.

Each payment attempt has one refund record and a stable PayMongo idempotency key.
Uncertain submissions retain that key; a 60-second lease prevents concurrent
submissions. An unknown submission older than 23 hours requires manual provider
review instead of risking a duplicate after the provider's key retention window.
Known refunds are retrieved through the provider API using **Check refund status**.
Failed refunds require support/provider investigation; no new charge or replacement
refund is created automatically. The UI refreshes saved progress every 30 seconds
and on focus. There is no refund webhook or background provider reconciliation in
this change. A booking closes only when every recorded refund succeeds and no
verified payment remains unrefunded. PayMongo's succeeded state means the refund
was sent to its payment partner, not that the client has already seen the credit;
see [PayMongo refund states](https://docs.paymongo.com/reference/refund-resource).

Work controls also check numeric amounts rather than trusting a `paid` label.
The database rejects work, delivery, or completion while a balance is outstanding,
including historical bookings without a balance deadline. Browser inserts cannot
fabricate a paid or completed booking by omitting payment-method metadata.

The ad booster charges a fixed PHP 50 daily rate by default. Workers select
1–365 whole days; the panel and payment review calculate the one-time total as
daily rate × days. The budget is no longer editable. Checkout retries retain
their operation ID after a network error so an uncertain response does not
start a second operation.

Set `VITE_AD_BOOST_DAILY_RATE_PHP` for the frontend and
`AD_BOOST_DAILY_RATE_PHP` in Supabase Edge Function secrets to the same daily
rate, then rebuild the frontend and redeploy `create-paymongo-boost-checkout`.
Both default to `50` when unset. Rates accept PHP 1–27,397.26 with up to two
decimal places, keeping a 365-day total within the existing checkout limit.
Malformed configuration blocks checkout. The function calculates the charge
independently and rejects a different browser total or pending-attempt price
before opening PayMongo. A pending checkout with old pricing must expire
before a new one can start; existing paid boosts retain their purchased term.
The database continues to use its existing payment-attempt contract.

Pricing verification: `node --test tests/integration/boost-pricing.node.mts`,
`npm run check`, and `npm run test:e2e -- tests/e2e/gig-boost-payment.e2e.spec.ts`.

Validation: `npm run check`; booking/payment, boost, dispute/refund, dispute recovery,
and admin support Playwright journeys; five Deno function tests with mocked provider
responses; and the refund SQL workflow against an isolated PostgreSQL fixture.
Post-deployment verification confirmed both migration versions, active JWT-protected
function status, participant reads of case/refund progress, private reason protection,
non-admin approval rejection, unauthenticated rejection, unavailable-case protection,
and a successful participant status check without issuing a refund. All 36 relevant
Playwright journeys passed after deployment. Actual refund issuance has not yet been
rehearsed against PayMongo's sandbox. Run the Edge Function tests with
`deno test --allow-env supabase/functions/process-booking-refunds/handler.deno.ts`.
The SQL fixture in `tests/integration/fixtures/refund-schema.sql` is only for an
empty disposable test database; load it, the two migrations, then
`tests/integration/refund-workflow.sql`. Never apply the fixture to the app database.

## References

- [PayMongo Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout)
- [Hosted Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
- [Webhook setup and signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)
- [Webhook testing](https://docs.paymongo.com/docs/webhook-testing)
