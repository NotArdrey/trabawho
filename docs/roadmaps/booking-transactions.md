# Booking and Payment Transaction Roadmap

## Purpose

This roadmap tracks the work required to make TrabaWho's booking, payment,
completion, cancellation, refund, dispute, and provider-payout workflows safe and
predictable.

It covers product behavior and backend boundaries. It does not authorize a
production payment launch. Production activation requires payment-provider
onboarding, legal and accounting review, operational ownership, and successful
end-to-end verification.

## Current assessment

The database already has useful foundations:

- Atomic capacity checks for direct slot bookings
- A database-enforced 5% platform fee
- Service-role-only online payment confirmation
- Audited delivery and completion transitions
- Buyer confirmation and timed auto-confirmation
- Completion and participant checks before reviews
- Basic dispute fields and immutable audit events

The current flow is not ready for real money because the interface generates a
local `MOCK-*` payment reference while the database requires a trusted server to
confirm payment. Cancellation, refund, slot-release, and provider-payout
workflows are also incomplete.

## Guiding rules

1. The browser may request a transition but must not authorize it.
2. Database columns, not JSON metadata, are the source of truth for financial and
   lifecycle state.
3. Payment status changes only after a verified provider response or signed
   webhook.
4. Every operation that affects money or capacity is atomic and idempotent.
5. Every terminal or financial transition creates an immutable audit event.
6. A booking must always show the next required actor and action.
7. Cancellation, refund, dispute, and payout rules are visible before payment.

## Target lifecycle

```text
REQUESTED
   -> QUOTED
   -> SLOT_HELD -------------------------------> EXPIRED
   -> PAYMENT_PROCESSING ----------------------> PAYMENT_FAILED
   -> CONFIRMED
   -> IN_PROGRESS
   -> DELIVERED
        -> buyer confirms ---------------------> COMPLETED
        -> review timer expires ---------------> COMPLETED
        -> buyer opens dispute ----------------> DISPUTED -> RESOLVED
   -> PAYOUT_ELIGIBLE
   -> PAYOUT_PROCESSING
   -> PAID_OUT

Eligible non-terminal states
   -> CANCELLATION_REQUESTED
   -> REFUND_PROCESSING
   -> CANCELLED / REFUNDED
   -> slot capacity released
```

Payment and payout states remain separate from booking delivery state. A booking
must not be described as paid, refunded, or paid out solely because its display
status changed.

## Phase 0: Product and payment decisions

Status: Not started

Before implementation, record these decisions:

- [ ] Choose the payment provider and approved integration product.
- [ ] Confirm whether the platform is merchant of record, payment facilitator,
      or only redirects clients to providers.
- [ ] Confirm whether the selected provider supports marketplace settlements or
      provider payouts.
- [ ] Define who absorbs the 5% platform fee and payment-provider fees.
- [ ] Define payout timing after completion and disputes.
- [ ] Define cancellation windows, late-cancellation fees, no-show handling, and
      provider-cancellation consequences.
- [ ] Define refund eligibility and whether the platform fee is refundable.
- [ ] Define the downpayment balance deadline and failed-payment behavior.
- [ ] Obtain legal and accounting review before representing held funds as
      escrow or custody.

Initial demo decision:

- Use PayMongo test mode with hosted checkout.
- Support GCash first.
- Create checkout sessions in a Supabase Edge Function.
- Treat the signed PayMongo webhook as the payment source of truth.
- Keep all sandbox language explicit until live credentials and production
  onboarding are complete.

Implementation status on October 1, 2026:

- Checkout, webhook, payment-attempt migration, and browser integration are
  implemented locally.
- Migration application, Edge Function deployment, secret configuration,
  PayMongo webhook registration, and sandbox end-to-end verification remain
  pending.

## Phase 1: Payment foundation

Priority: P0 -- required before any real-money demo

### Data model

- [ ] Add a `payment_attempts` table containing:
  - booking ID
  - provider name
  - provider checkout/session ID
  - provider payment ID
  - internal idempotency key
  - amount and currency
  - purpose: initial payment or remaining balance
  - status: created, awaiting_payment, processing, paid, failed, expired,
    cancelled, or refunded
  - failure code and safe failure message
  - timestamps
- [ ] Add a `payment_provider_events` table keyed by provider event ID.
- [ ] Store the raw event only where retention and privacy policy permit it.
- [ ] Add unique constraints for provider IDs and idempotency keys.
- [ ] Never store API secrets, access tokens, or full payment credentials.

### Server integration

- [ ] Create a Supabase Edge Function that authenticates the buyer and creates a
      PayMongo hosted checkout session.
- [ ] Calculate the payable amount from database values, never request values.
- [ ] Attach the booking ID and payment-attempt ID as provider metadata or the
      supported reference field.
- [ ] Create a webhook Edge Function that:
  - reads the raw request body
  - verifies `Paymongo-Signature`
  - rejects stale or invalid signatures
  - deduplicates by provider event ID
  - verifies amount, currency, booking, environment, and payment status
  - invokes the controlled payment-recording RPC
  - acknowledges safely and records processing failures for reconciliation
- [ ] Add a reconciliation job for provider events missed during downtime.
- [ ] Remove local `MOCK-*` reference generation from production booking paths.

### Client behavior

- [ ] Replace simulated payment completion with redirect-to-checkout behavior.
- [ ] After returning from PayMongo, display `Verifying payment` until the server
      confirms it.
- [ ] Do not trust success query parameters from the return URL.
- [ ] Preserve the booking and payment-attempt ID across refreshes.
- [ ] Provide retry, expired-session, failed-payment, and already-paid states.

### Acceptance criteria

- [ ] A successful test GCash payment confirms exactly one booking.
- [ ] Closing the browser before redirect does not lose a successful payment.
- [ ] Replaying the same webhook does not duplicate payment or audit records.
- [ ] A forged client response cannot mark a booking paid.
- [ ] Amount or currency mismatches are rejected and alerted.
- [ ] Failed and expired payments leave the booking recoverable.

## Phase 2: Transactional slot holds and booking creation

Priority: P0

- [ ] Add `hold_expires_at` and an explicit slot-hold state.
- [ ] Create one RPC that locks the slot, checks capacity, creates or updates the
      booking, creates the payment attempt, and records the hold.
- [ ] Add an expiration job that releases unpaid holds.
- [ ] Create controlled RPCs for cancellation, rescheduling, and slot release.
- [ ] Recalculate slot availability from authoritative active bookings or keep
      counters synchronized in the same transaction.
- [ ] Route request-flow slot selection through the same capacity checks as
      direct booking.
- [ ] Reject past slots and invalid time ranges.
- [ ] Reject self-booking.
- [ ] Prevent duplicate active requests with a database constraint or a
      transaction-safe idempotency key.

### Acceptance criteria

- [ ] Concurrent requests cannot exceed slot capacity.
- [ ] An unpaid hold expires and becomes bookable again.
- [ ] Cancelling or rescheduling releases the old capacity exactly once.
- [ ] Retrying booking creation returns the existing booking.
- [ ] A provider cannot book their own listing.

## Phase 3: Server-owned booking state machine

Priority: P0

- [ ] Replace general-purpose client booking updates with role-specific RPCs.
- [ ] Define legal transitions for buyer, provider, payment server, scheduler,
      and administrator roles.
- [ ] Move quote, cancellation, refund, and scheduling state out of writable
      metadata and into typed columns or dedicated tables.
- [ ] Keep metadata descriptive only.
- [ ] Require reason, actor, previous state, next state, and idempotency key for
      sensitive transitions.
- [ ] Use stable operation IDs across retries instead of generating a new key on
      every attempt.

Suggested RPC boundary:

```text
create_booking_request
propose_booking_quote
accept_booking_quote
reject_booking_quote
hold_booking_slot
reschedule_booking
cancel_booking
mark_booking_in_progress
mark_booking_delivered
confirm_booking_completion
open_booking_dispute
resolve_booking_dispute
```

## Phase 4: Quote and scope integrity

Priority: P1

- [ ] Add immutable quote versions with service scope, amount, schedule terms,
      expiry, proposer, and timestamps.
- [ ] Make acceptance target a specific quote version.
- [ ] Prevent price or scope changes after acceptance without a new version.
- [ ] Snapshot service title, description, price basis, location, provider, fee,
      and applicable policy at confirmation.
- [ ] Resolve the trigger interaction that can reject seller price updates after
      payment-plan amounts are recalculated.

## Phase 5: Downpayment and balance collection

Priority: P1

- [ ] Add `balance_due_at`.
- [ ] Show the full payment schedule before confirmation.
- [ ] Restrict downpayment eligibility based on lead time and booking value.
- [ ] Notify the buyer before the due date.
- [ ] Create a separate payment attempt for the remaining balance.
- [ ] Define retry, grace-period, cancellation, and provider-waiver behavior.
- [ ] Prevent service delivery when policy requires full payment first.

## Phase 6: Cancellation and refunds

Priority: P0 before live payments

- [ ] Add versioned cancellation policies and snapshot the applicable policy on
      the booking.
- [ ] Calculate refund and cancellation-fee amounts on the server.
- [ ] Create a refund record linked to the original payment attempt.
- [ ] Submit refunds through the payment provider.
- [ ] Move to `refunded` only after a verified provider event.
- [ ] Return funds to the original payment method where supported.
- [ ] Handle partial refunds, failed refunds, duplicate requests, and manual
      review.
- [ ] Release slot capacity as part of the cancellation transaction.

Refund states:

```text
requested -> under_review -> approved -> processing -> succeeded
                                  |            |
                                  v            v
                               rejected      failed
```

## Phase 7: Provider payout and ledger

Priority: P0 before operating as a collecting marketplace

- [ ] Add an append-only financial ledger.
- [ ] Record customer charge, platform fee, processor fee, provider payable,
      refund, adjustment, chargeback, and payout as separate entries.
- [ ] Add provider payout eligibility, processing, paid, failed, and reversed
      states.
- [ ] Release payout only after completion and the applicable dispute window.
- [ ] Reconcile provider payout references with the payment provider.
- [ ] Provide an auditable administrator view without allowing direct balance
      edits.

The booking total is not a ledger. Financial reporting must be derived from
immutable entries rather than mutable booking fields.

## Phase 8: Disputes and operational tools

Priority: P1

- [ ] Connect the existing dispute RPC to buyer and provider interfaces.
- [ ] Define dispute windows and evidence requirements.
- [ ] Pause payout while a dispute is open.
- [ ] Add administrator resolution actions with mandatory reasons.
- [ ] Notify both parties about deadlines and outcomes.
- [ ] Add reconciliation queues for payment, refund, payout, and webhook errors.
- [ ] Add alerts for amount mismatches, repeated webhook failures, stuck holds,
      and overdue balances.

## Phase 9: Security and abuse controls

Priority: Continuous

- [ ] Verify RLS for every booking, payment, refund, payout, and audit table.
- [ ] Remove participant-wide update access where RPCs can enforce narrower
      authorization.
- [ ] Rate-limit checkout creation, booking requests, and refund requests.
- [ ] Reject self-booking and review manipulation.
- [ ] Validate webhook signatures using constant-time comparison where
      applicable.
- [ ] Separate test and live provider events and credentials.
- [ ] Redact secrets and sensitive provider payloads from logs.
- [ ] Require administrator reasons for exceptional financial actions.

## Phase 10: Verification and release gates

Priority: Required for each phase

### Database and service tests

- [ ] Concurrent capacity tests
- [ ] Duplicate request and stable-idempotency tests
- [ ] RLS tests for buyer, provider, unrelated user, administrator, and service
      role
- [ ] Payment webhook signature, replay, mismatch, failure, and recovery tests
- [ ] Cancellation and slot-release tests
- [ ] Full and partial refund tests
- [ ] Downpayment and balance-deadline tests
- [ ] Delivery, completion, auto-confirmation, and dispute tests
- [ ] Payout eligibility and ledger-balance tests

### End-to-end journeys

- [ ] Full-payment booking
- [ ] Downpayment followed by balance payment
- [ ] Abandoned checkout and expired hold
- [ ] Payment succeeds while the browser is closed
- [ ] Buyer cancellation before and after the policy deadline
- [ ] Provider cancellation
- [ ] Refund succeeds and refund fails
- [ ] Delivery confirmation and timed auto-confirmation
- [ ] Dispute pauses completion or payout
- [ ] Mobile and keyboard operation for every blocking dialog

### Required release checks

- [ ] `npm run check`
- [ ] Relevant Playwright booking and payment journeys
- [ ] PayMongo sandbox end-to-end verification
- [ ] Webhook replay and outage recovery drill
- [ ] Reconciliation report matches provider sandbox records
- [ ] No test credentials or sandbox claims appear in production configuration

## PayMongo credential handling

Never place a PayMongo secret key in source files, browser-prefixed environment
variables, screenshots, chat messages, documentation, or commits.

For the recommended hosted-checkout demo:

| Credential | Needed | Location |
| --- | --- | --- |
| PayMongo test secret key (`sk_test_...`) | Yes | Supabase Edge Function secret only |
| PayMongo test public key (`pk_test_...`) | No for hosted checkout | Reserve for a future browser SDK flow |
| Webhook signing secret | Yes after webhook registration | Supabase Edge Function secret only |

Suggested server secret names:

```text
PAYMONGO_SECRET_KEY
PAYMONGO_WEBHOOK_SECRET
PAYMONGO_ENVIRONMENT=test
```

If a later integration genuinely requires the public key in the browser, expose
only the test or live public key appropriate to that environment. Never expose
`PAYMONGO_SECRET_KEY` through a `VITE_*` variable.

## External references

- [PayMongo hosted checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout)
- [PayMongo webhook setup and signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)
- [PayMongo webhook events](https://docs.paymongo.com/docs/developer-tools-webhooks-events)
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Airbnb request authorization and expiry](https://www.airbnb.com/help/article/313)
- [Airbnb scheduled payments](https://www.airbnb.com/help/article/2143)
- [Upwork fixed-price payment protection](https://support.upwork.com/hc/en-us/articles/211062568-How-Upwork-protects-your-payments)

## Repository areas involved

- `src/features/bookings/`
- `src/features/work/`
- `src/features/marketplace/`
- `supabase/functions/`
- `supabase/migrations/`
- `docs/integrations/`

Update this roadmap when a decision is made, a phase begins, or acceptance
criteria are satisfied. Do not mark a phase complete based only on interface
behavior; its database, provider, security, and recovery checks must also pass.
