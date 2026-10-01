# PayMongo

TrabaWho uses PayMongo Hosted Checkout v2 for the card sandbox flow. Checkout
sessions are created by a Supabase Edge Function, and only a signed PayMongo
webhook may confirm payment in the database.

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

If checkout creation fails, the booking remains payment-pending until its hold
expires and may be retried with the same browser operation ID. A paid webhook
received after expiry is marked for refund review and does not reclaim the
released slot. If webhook processing fails, leave
the booking pending, inspect function logs without printing secrets or raw
customer data, and reconcile the provider payment before any manual action.

## References

- [PayMongo Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout)
- [Hosted Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
- [Webhook setup and signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)
- [Webhook testing](https://docs.paymongo.com/docs/webhook-testing)
