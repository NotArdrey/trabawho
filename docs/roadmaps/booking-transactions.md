# Booking and Payment Transaction Roadmap

## Purpose

This roadmap tracks the work required to make TrabaWho's booking, payment,
completion, cancellation, refund, dispute, and provider-payout workflows safe and
predictable.

It covers product behavior and backend boundaries. It does not authorize a
production payment launch. Production activation requires payment-provider
onboarding, legal and accounting review, operational ownership, and successful
end-to-end verification.

The admin-facing support queue, exception matrix, and moderation requirements
are tracked in the [admin operations roadmap](admin-operations.md).

## Current assessment

The database already has useful foundations:

- Atomic capacity checks for direct slot bookings
- A database-enforced 5% platform fee
- Service-role-only online payment confirmation
- Audited delivery and completion transitions
- Buyer confirmation and timed auto-confirmation
- Completion and participant checks before reviews
- Basic dispute fields and immutable audit events

The working demo path now redirects to PayMongo hosted card checkout and waits
for its signed webhook before confirming payment. It is still not ready for
real money because refund execution, reconciliation, cancellation policy,
provider payouts, and production operations remain incomplete.

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

## Recommended service transaction policy

**Product direction, not implemented or legally approved.** For direct-slot
bookings, paying **50% of the service price** is required to confirm the
schedule; do not offer full payment at booking. The current full-payment UI and
backend option conflict with this rule and must be changed together. The
platform fee, provider processing fees, refundability, and final settlement
model still require explicit policy and accounting decisions. Until they are
approved, PayMongo remains test-only and this section is a panel-ready design,
not a claim that TrabaWho already holds or releases real funds.

### Client and provider journey

1. **Reserve:** Show the agreed scope, service price, 50% deposit, platform fee,
   remaining balance, appointment, cancellation terms, and claim route before
   checkout. Collect the deposit through a separate payment attempt. Confirm
   the slot only after a verified provider event; an abandoned or failed
   checkout leaves a recoverable request and releases an expired hold.
   For a PHP 900 service with a PHP 45 platform fee, the proposed display is
   PHP 495 due at booking (PHP 450 deposit + PHP 45 fee), then PHP 450 balance.
   Whether the fee is refundable is **not decided**.
2. **Fund the balance before work:** Offer a second checkout and send reminders
   before a clearly disclosed due time, proposed as before the appointment
   starts. The provider sees whether both payments are verified and is told
   **not to begin** while the balance is due. An overdue balance pauses the
   job and opens a reschedule/cancellation case; it never becomes "paid" just
   because the client promises to pay. Collecting only after work would leave
   the provider exposed if the client refuses; a handover code cannot collect
   money. A narrow, audited exception policy would be needed for emergencies.
3. **Record delivery:** The provider submits a service-specific checklist and
   appropriate before/after evidence, with timestamps and a privacy/retention
   policy. Notify the client to confirm the agreed work or report a problem.
   An optional short-lived in-app PIN/QR can corroborate an in-person handover,
   but is neither required in a dispute nor sufficient proof by itself. Never
   treat a screenshot alone as conclusive evidence.
4. **Confirm or dispute:** Client confirmation completes the delivery step. If
   the client contests quality, scope, or attendance, create a case, preserve
   both parties' evidence and messages, and pause auto-completion and payout.
   If the client does not respond, a disclosed, notified review timer may
   auto-confirm only when full payment and adequate delivery evidence are
   verified and no case is open. An administrator cannot invent a payment or
   dismiss a dispute by changing a display label.
5. **Settle and support workmanship:** Calculate provider payable, platform
   fee, processor fee, refund, and adjustments from an append-only ledger.
   Payout eligibility follows verified payment, completion, and the initial
   dispute window; actual release depends on an approved provider settlement
   arrangement. Offer a proposed seven-day, scope-specific workmanship claim
   window after completion: assess in-scope defects, offer rework where
   appropriate, then a policy-backed partial/full refund if justified. The
   claim window need not withhold every provider payout for seven days, but
   post-payout remedies require an agreed financial reserve/recoupment model.
   Cleaning, events, and repairs need different evidence and claim terms.

### Exception paths that must be visible to both parties

| Event | Safe next step | Money and booking state |
| --- | --- | --- |
| Provider no-show | Client reports it; provider responds; support reviews the appointment, messages, and attendance evidence. | Do not mark delivered or pay out. Apply a published reschedule/refund decision. |
| Client no-show | Provider reports it; client responds; support reviews evidence. | Do not automatically charge the balance or award the full price. Apply the published deposit/cancellation rule. |
| Cancellation before payment | Release the slot and close the request. | No refund claim because no verified payment occurred. |
| Cancellation after deposit or full funding | Show the applicable policy and estimate before confirmation; allow support review for exceptions. | Keep cancellation and refund states separate; mark refunded only after verified provider evidence. |
| Balance overdue | Remind the client, then pause the appointment and route to reschedule/cancellation support. | Keep the balance due; provider must not start work by default. |
| Delivery or seven-day workmanship claim disputed | Let both parties submit evidence; assign an owner and record a reasoned outcome. | Pause payout where possible; use rework or provider-confirmed refund rather than a fabricated completion/refund. |
| Payment, refund, or payout event missing/duplicated | Reconcile against provider records using immutable IDs and retry safely. | Keep the last verified state and show "verifying" or "needs review," never a guessed success. |

### Provider, legal, and implementation gates

- The current PayMongo hosted checkout supports separate charges, but its
  [hold-then-capture feature](https://docs.paymongo.com/docs/payment-acceptance-hold-then-capture)
  is restricted to eligible activated merchants, card payments, and holds of
  up to seven days. Do not rely on it to secure every future balance payment.
- [PayMongo split payments](https://developers.paymongo.com/docs/seeds-payment-splitting)
  require account configuration and allocate funds at checkout; they do not
  automatically provide dispute-aware escrow or delayed provider release.
  Confirm merchant-of-record, provider onboarding, payout timing, liability,
  and reconciliation with the payment partner and legal/accounting advisers
  before promising automatic provider settlement.
- [PayMongo's refund documentation](https://developers.paymongo.com/v1/docs/refunding-transactions)
  describes provider refunds for live payments. A test-mode refund screen may
  rehearse case decisions but must not claim that a real refund was executed.
- A seven-day TrabaWho claim promise cannot be worded as the end of statutory
  consumer remedies. The [Philippine Consumer Act](https://standardsph.dti.gov.ph/upload/upload/download?file=e4f8n8H2Sa3uc20230927651374470a596.pdf&path=storage%2Fuploads%2Fsdac%2Fpns%2Flaws_issuances%2F)
  addresses warranties in consumer services; obtain local legal review for
  category-specific scope, exclusions, and remedies.
- Implement the deposit-only rule in the payment RPC as well as the UI;
  create separate deposit and balance attempts, immutable event/audit IDs,
  reminders and deadlines, completion evidence, case intake, provider-confirmed
  refunds, and a payout ledger. Do not mark these delivered from a UI demo.
- Reviews already have a completed-booking/participant database check, but
  anti-spam remains a later requirement: enforce one review per booking,
  server-side rate limits, report/moderation and appeal, and label seeded demo
  reviews separately from verified customer reviews.

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
For the proposed direct-slot deposit policy, `CONFIRMED` requires the verified
deposit, `IN_PROGRESS` requires a verified balance or a documented exception,
and a later workmanship claim is a separate case rather than silently undoing
the completion or payout state.

## Phase 0: Product and payment decisions

Status: Product direction drafted; operational and legal decisions pending

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
- [ ] Approve the mandatory 50% direct-slot deposit, balance-before-work
      deadline, fee allocation, and failed/overdue-payment behavior.
- [ ] Define the evidence threshold, client response timer, no-show policy,
      seven-day category-specific claim scope, and post-payout remedy funding.
- [ ] Obtain legal and accounting review before representing held funds as
      escrow or custody.

Initial demo decision:

- Use PayMongo test mode with hosted checkout.
- Support PayMongo hosted card checkout first.
- Keep GCash visible but disabled as `Coming soon` until it has a working,
  verified integration.
- Create checkout sessions in a Supabase Edge Function.
- Treat the signed PayMongo webhook as the payment source of truth.
- Keep all sandbox language explicit until live credentials and production
  onboarding are complete.

Implementation status on October 1, 2026:

- Checkout, webhook, payment-attempt and slot-hold migrations, browser
  integration, and both Edge Function deployments are applied to the TrabaWho
  Supabase project.
- The PayMongo test API secret, paid-checkout webhook registration, and webhook
  signing secret are configured. Signed endpoint verification passes; a full
  sandbox checkout using an authenticated test booking remains pending.

### October 2, 2026 demo rehearsal

- Applied `20261002090000_guard_paid_booking_delivery.sql` to the confirmed
  demo/test Supabase project after a dry run showed it was the only pending
  migration. Remote migration history confirms it is applied. Production was
  not changed.
- Live RPC checks rejected delivery of a partially paid booking and delivery
  by a client; neither booking changed. Focused lifecycle tests cover stable
  operation IDs, duplicate clicks, retries, and visible next actions.
- A fresh direct-slot booking reached PayMongo hosted test checkout and its
  success screen showed the test payment received. **The associated booking
  and payment attempt remained pending afterward.** The signed webhook path
  has not been verified end to end; do not treat the provider success screen
  or browser return as payment confirmation. Inspect the PayMongo test-mode
  Webhooks → Event Deliveries entry for reference
  `TW-6687B37C21B84425AE07` and the Supabase webhook function logs, then
  resolve the delivery/processing failure and retry the original event if
  appropriate. Do not manually mark this booking paid.
- Separately, an existing paid demo booking was delivered by the provider and
  completed by the client through their booking screens. The completed booking
  remained visible after refresh and switching back to the provider account.
  The final database state and audit events survived refresh; same-operation RPC retries returned
  the completed booking without duplicate events. Three paid, undelivered
  bookings remained available for the presentation fallback at verification.
- The fresh-booking path is **not yet presentation-ready** until its webhook
  confirms payment and the full journey is repeated on that new booking.

### October 2, 2026 transaction-flow rehearsal (demo/test only)

- Applied `20261003090000_demo_booking_transaction_flow.sql` and
  `20261003093000_enforce_new_direct_slot_deposits.sql` to the confirmed
  demo/test project, not production. New direct-slot checkouts require the
  50% service-price deposit plus the platform fee; a separate attempt collects
  the other 50%. Historical full-payment bookings remain valid.
- A fresh Garden Cleanup & Yard Work booking
  `ca3d0be9-1458-46a6-a404-2992d8314ffe` completed the direct-slot journey
  across separate client and provider accounts. PayMongo test checkout showed
  receipt of the PHP 522.50 deposit and PHP 475 balance. Neither payment was
  recorded automatically by the webhook. The authenticated server-side
  reconciliation function independently retrieved each checkout from PayMongo,
  checked the booking/attempt reference, test environment, amount, currency,
  and paid payment ID, then recorded it through the existing idempotent payment
  RPC. Only then did the booking become partially paid, then fully paid.
- The recovery endpoint was exercised directly with authenticated test-account
  sessions. The updated browser return polling passed unit tests but has not
  yet been re-rehearsed through the deployed frontend. This remains a
  presentation check, not a completed browser journey.
- The provider started work in the allowed appointment window, submitted the
  checklist and written delivery proof, and marked delivery. The client read
  the proof and confirmed completion. Refreshes and separate-account reads
  retained `completed`, `buyer_confirmed`, and `paid`; a same-operation retry
  did not create another completion. Wrong-role work start, ineligible garden
  warranty claim, and unrelated-provider evidence access were rejected.
- A no-show report was saved on a separate existing test booking and was
  visible to the admin's read-only case queue. No refund or payout occurred.
  An older paid, undelivered booking remains available for the delivery and
  completion fallback; it was not consumed by this rehearsal.
- **Known P0 gap:** the PayMongo webhook still did not automatically confirm
  either fresh test checkout. The server-side PayMongo API recovery path makes
  the browser return recoverable, but this is not proof that webhook delivery
  works. Inspect test-mode webhook event deliveries and Edge Function logs,
  repair the failing registration/delivery/processing step, and test duplicate
  and delayed events before claiming webhook reliability or a real-money launch.
  An earlier payment after an expired hold correctly stayed unconfirmed and
  needs support review; the UI must not treat a PayMongo success screen alone
  as a reserved slot.
- The return screen now asks the payment server to check PayMongo even when an
  attempt is locally expired or failed. If the provider confirms a charge
  after the slot hold expired, the existing payment RPC records `late_paid`
  and `refund_pending` for support review; the screen explicitly says the
  booking was **not** confirmed and asks the client not to pay again. This
  branch has a focused UI test, but has not been live-rehearsed through the
  deployed frontend. It is not a refund integration.
- That rehearsal used a provisional service-title classification for repair
  eligibility. The explicit service policy below replaces it for new bookings;
  support ownership, no-show remedies, cancellation terms, verified refunds,
  and payouts remain open.

### Explicit repair-workmanship policy (demo/test implementation)

- Applied `20261003100000_explicit_repair_workmanship_policy.sql` only to the
  confirmed demo/test project. A public read verified that only the four
  designated listing IDs expose `repair_workmanship_7d`. Focused UI tests and
  the project check pass; a new in-window/out-of-window case has **not** yet
  been rehearsed across separate accounts after this migration.
- New direct-slot bookings now snapshot a versioned, admin-controlled service
  policy at checkout. Listing titles no longer decide coverage. The designated
  demo listings are Computer & Printer Repair, Plumbing Leak Repair, Appliance
  Installation & Repair, and Handyman Home Repairs. Furniture Assembly & Minor
  Repairs, cleaning, garden, laundry, painting, and events are not designated.
  Future listings have no automatic repair policy until explicitly configured.
- The `demo-v1` policy offers a **seven-day (168-hour) issue-reporting window**
  measured from server-recorded completion for possible problems with the
  original repair workmanship. The checkout and booking details disclose the
  snapshot. A timely report on a designated booking is automatically routed
  as a provider **rework request**. That route is not a finding that the defect
  is covered; the provider must review the report and evidence.
- A late report, a non-designated service issue, or an earlier booking without
  the explicit snapshot is routed to **support review**. Older provisional
  eligibility flags are not silently erased, but do not gain automatic rework.
  Cases remain visible to both booking participants and the admin queue.
- Neither route automatically refunds, pays out, closes a case, or decides
  liability. A structured provider response is now implemented: the booked
  provider may once offer inspection/rework or request support review, with a
  required explanation. The response is audited and visible to both parties
  and the read-only admin queue. It cannot close the case or change payment.
  Evidence standards, a client acceptance/rework scheduling flow, escalation
  owner, final remedy authority, and legally reviewed customer terms remain
  required before this can be represented as a production warranty.
- Applied `20261003103000_repair_claim_provider_response.sql` and the
  response-completeness guard `20261003104000_guard_repair_response_completeness.sql`
  to the confirmed demo/test project after dry runs showed each as the only
  pending migration.
  Local checks passed (173 tests, typecheck, lint, standards, build) and the
  existing admin browser journey passed. A live client attempt to answer an
  existing case was rejected by the server as wrong-role. There are currently
  no `rework_request` cases in the demo/test project; its completed repair
  bookings predate the explicit policy snapshot. A fresh paid repair booking,
  in-window claim, provider answer, and client/admin refresh still need a
  two-account rehearsal. No historic booking was relabelled or fabricated.
- The follow-up rework path is implemented in
  `20261003110000_repair_rework_resolution.sql` with the immutable-history
  guard `20261003111000_immutable_rework_case_actions.sql`; both are applied to the confirmed
  demo/test project. After a provider offers rework, the provider proposes a
  future return visit, the client accepts or escalates, the provider records
  rework notes near the accepted appointment, and the client confirms the
  result or escalates. Case actions are append-only, role-checked, and
  idempotent. Client confirmation closes the case; escalation leaves it under
  support review. Neither action changes payment or payout state.
- Focused unit/component checks cover the visible next actor, duplicate
  clicks, stable retries, appointment timing, and client confirmation. The
  admin case queue shows the next actor. `npm run check` passes (188 tests),
  the queue passed browser checks at 390, 768, 1024, 1280, and 1440 pixels,
  and the existing admin journey passed on retry after one transient Supabase
  fetch failure on the client dashboard. A live admin attempt to advance an
  existing case was rejected as wrong-role. A fresh eligible repair booking is
  still required to rehearse this
  *positive* path across two live accounts; historical bookings were not
  backfilled or used to simulate it. Admin remedy decisions, verified refunds,
  payouts, notifications, and legally reviewed terms remain out of scope.
- Admin case detail now displays the booking, participant, payment-attempt,
  delivery-evidence, and audit records available to the administrator. A
  private, append-only follow-up can record information needed or a recommended
  rework, reschedule, or refund review with a mandatory reason and stable
  operation ID. This is **not** a decision, notification, payment, or refund.
  The two admin follow-up migrations (`20261003113000` and `20261003114000`)
  are applied only to the confirmed demo/test project. Client-role rejection
  and the admin case browser journey were verified; a positive live admin
  follow-up/retry on real demo case data remains untested.

### Dispute refund and balance protection follow-up (sandbox backend deployed)

The change adds participant refund-review requests and visible case progress,
admin-confirmed full sandbox refunds tied to verified payment attempts, server-side
PayMongo submission/reconciliation, and protected refund status/reference displays.
Numeric funding guards cover work start, delivery, and completion across historical
bookings; browser inserts cannot fabricate paid completion by omitting metadata.
Booster input feedback and retry operation retention are also corrected.

The two `20261005` migrations are applied to the `.env` TrabaWho demo/test project,
and `process-booking-refunds` version 1 is active with JWT verification. Deployed
permission and participant status-check probes passed, along with all 36 relevant
browser journeys. See deployment verification in [the PayMongo integration guide](../integrations/paymongo.md).
Isolated PostgreSQL and mocked provider tests verify the money transitions; actual
PayMongo sandbox refund issuance remains untested. Partial refund policy, production activation, failed
refund recovery, background refund reconciliation, and payouts remain open.

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

- [ ] A successful PayMongo test-card payment confirms exactly one booking.
- [ ] Closing the browser before redirect does not lose a successful payment.
- [ ] Replaying the same webhook does not duplicate payment or audit records.
- [ ] A forged client response cannot mark a booking paid.
- [ ] Amount or currency mismatches are rejected and alerted.
- [ ] Failed and expired payments leave the booking recoverable.

## Phase 2: Transactional slot holds and booking creation

Priority: P0

- [x] Add `hold_expires_at` and an explicit slot-hold state.
- [x] Create one RPC that locks the slot, checks capacity, creates or updates the
      booking, creates the payment attempt, and records the hold.
- [x] Add an expiration job that releases unpaid holds.
- [x] Create controlled RPCs for cancellation, rescheduling, and slot release.
- [x] Recalculate slot availability from authoritative active bookings or keep
      counters synchronized in the same transaction.
- [x] Route request-flow slot selection through the same capacity checks as
      direct booking.
- [x] Reject past slots and invalid time ranges.
- [x] Reject self-booking.
- [x] Prevent duplicate active requests with a database constraint or a
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
- [ ] Make the 50% service-price deposit the only direct-slot booking checkout
      option; remove full payment at reservation in both UI and server rules.
- [ ] Decide whether any service category needs different deposit terms before
      enabling that category.
- [ ] Notify the buyer before the due date.
- [ ] Create a separate payment attempt for the remaining balance.
- [ ] Set a disclosed balance deadline before work starts and define retry,
      grace-period, reschedule/cancellation, and audited exception behavior.
- [ ] Prevent work-start and service delivery when full payment is required but
      the balance is not verified.

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
