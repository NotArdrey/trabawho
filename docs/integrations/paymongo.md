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

## References

- [PayMongo Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout)
- [Hosted Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
- [Webhook setup and signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)
- [Webhook testing](https://docs.paymongo.com/docs/webhook-testing)
