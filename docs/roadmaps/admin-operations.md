# Admin Operations Roadmap

## Purpose and current boundary

This is the minimum operational scope for a trustworthy TrabaWho marketplace. It is a requirements roadmap, not a claim that refunds, payouts, or dispute resolution work today. The presentation uses PayMongo test mode only. Production payment activation remains gated by the decisions in the [booking and payment roadmap](booking-transactions.md).

The admin experience should prioritize **work requiring a decision** over decorative metrics. A useful overview begins with cases awaiting review, failed payment events, and unresolved access reports, each linking to the underlying booking or account. Counts must come from a real query; unavailable data must be labelled unavailable, never shown as zero.

## Capability inventory and priority

| Priority | Capability | Current state | Minimum behavior to build |
| --- | --- | --- | --- |
| Demo | Account search, role changes, disable/suspend/restore | **Available** | Keep server-backed feedback, reason capture, and role guard; verify RLS and privileged-action audit before production. |
| P0 | Identity review queue and decisions | **Implemented and rehearsed on the linked test project** | The portal loads manual/pending/duplicate reviews with protected evidence, address, status filters, email search, and pagination. Authenticated admin approval/rejection requires a reason, evidence acknowledgement, confirmation, and immutable history. Profile, claim, and session updates are atomic; approval retains the email-confirmation gate. See the [Didit integration guide](../integrations/didit.md). |
| Demo | Review list and deletion | **Partial** | Recent reviews load; deletion is permanent. Add reports, policy reason, non-destructive hide/restore, and audit before operational use. |
| Demo | Admin audit page | **Available for recorded sources** | Search and filter the latest 500 booking events, support follow-ups, and identity decisions per source, with actor, target reference, reason, time, and recorded outcome. Partial failures and source limits are visible. Account/access and review-moderation actions still require their own immutable feed. |
| P0 | Searchable booking/support queue | **Partial** | The latest 50 submitted booking cases can be filtered by status and searched by booking ID, issue type, or reason; the list shows the next actor for rework. This is not a full-database search. Add server-side pagination/search by reference and participants, age and urgency, and payment/cancellation exception filters. |
| P0 | Booking case detail | **Partial** | Admins can inspect the reported issue, participants, schedule, payment attempts, delivery evidence, and recorded booking/case actions. Partial fetch failures are identified before a follow-up can be recorded. Add linked chat, provider payment-event verification, explicit source/verification labels, and a complete paginated timeline. |
| P0 | Payment exception queue | **Not built** | Surface expired holds, failed or ambiguous checkout, mismatched webhooks, unpaid balance, refund failure, and chargebacks without manually changing money state. |
| P0 | Dispute intake and triage | **Partial** | Booking-scoped reports persist with optional private evidence. A versioned policy routes in-window designated repair reports to rework and exceptions to support review. The provider can propose a return visit, the client can accept or escalate, the provider records rework notes, and the client can confirm or escalate. Admins can record an information request or recommended rework, reschedule, or refund-review next step with a mandatory reason. These records do not notify parties or decide a defect/refund. Add owner, notifications, stronger evidence standards, and remedy authority. |
| P0 | Immutable admin activity | **Partial** | Case follow-ups have an admin-only, idempotent RPC, an append-only record, and a booking audit event. The audit page exposes recorded booking events, support follow-ups, and identity decisions; account/moderation actions still need the same reason-and-audit standard. |
| P1 | Resolution and appeals | **Not built** | Record a policy-backed outcome, notify both parties, preserve evidence, and allow a controlled appeal/review path. Never directly set paid/refunded from the UI. |
| P1 | Refund and payout operations | **Not built** | Use provider-confirmed refund/payout events, reconciliation, failure retries, and clear hold/release rules. No manual balance edits. |
| P1 | Report and moderation queue | **Not built** | Accept review/profile/chat reports, preserve original evidence, hide content reversibly, document reason, and support appeal. |
| P2 | Operational analytics | **Available for account, service, review, and case queries** | Admin overview and Analytics show new accounts and published-review counts/ratings for 7, 30, or 90 Philippine calendar days, daily trends, current active listings, and open/under-review support totals. Period queries paginate all rows; unavailable metrics are labelled, not shown as zero. Payment and revenue analytics need a verified platform-wide backend contract. |

## Registration and identity verification check

The registration UI validates each step before Next or Enter, restores the full
address after Didit return, and uses explicit checkboxes with a keyboard-accessible
Terms and Conditions modal. Manual and Didit signup persist province, city,
barangay, and specific address through a transactional backend registration RPC.
Client status and auto-approve environment overrides cannot approve identity.

The admin queue and protected evidence endpoints are deployed to the linked
Supabase test project. Live synthetic manual submissions were approved and
rejected through the authenticated admin endpoint. Full address persistence,
private image reads, repeated operations, conflicting decisions, and nonadmin
denial passed. Synthetic users and images were removed; immutable rehearsal
history remains. The configured Didit workflow and active V3 webhook destination
were verified through the provider API. A live session started and polled;
a forged browser approval was rejected without creating an account.

Rollback-only database tests cover the email-confirmation gate, terminal-session
races, immutable history, stale/duplicate events, and retryable failed deliveries.
Registration/admin Playwright journeys pass at 390, 768, 1024, 1280, and 1440px.
The live browser journey also verifies pending denial, protected admin approval,
and dashboard access after synthetic email confirmation. Didit delivered a signed
pending event; polling preserves its metadata and cannot bypass finalized review.
Browser terminal provider outcomes use mocked APIs. A real camera scan, signed
approved/declined provider delivery, and inbox receipt are separate release checks. Configuration,
deployment steps, and the exact test commands are in the
[Didit integration guide](../integrations/didit.md).

## Case-handling experience

Clients and workers can open **Support cases** from their desktop sidebar or
mobile navigation at `/support-cases`. This participant view lists reports for
their own bookings in either role, including closed cases. Each report links to
its case reference, participant conversation, existing rework actions, safe
support summaries, and refund progress. Internal admin follow-up notes remain
restricted to the admin portal. Selecting a case is stored in the URL.

The admin support queue now reconciles on case activity, focus, reconnect, and
every 15 seconds while visible. This covers projects without working realtime
publications. Refreshes retain loaded cases, the selected detail, and unfinished
follow-up notes. Mocked client-to-admin journeys verify report submission and
support updates at all five supported widths; live read checks verify existing
case-to-booking links without creating or changing records.

The demo/test implementation adds the case queue, private evidence access,
booking-specific review timeline, and reasoned follow-up records. The admin
may record a request for information or a recommendation, but this is not an
outbound message, accepted remedy, case closure, refund, payout, or
payment-override action. A test no-show report was visible to the admin after
submission. PayMongo test checkout was recoverable through server-side API
verification, but the webhook still did not automatically record two fresh
payments; a payment exception/reconciliation queue remains P0.

The admin follow-up migrations `20261003113000_admin_support_followup.sql` and
`20261003114000_private_admin_support_followup.sql` were applied only to the
confirmed demo/test project after dry runs. Internal follow-up notes are
admin-readable only; booking participants receive no automatic message. The
RPC rejects a signed-in client, and the case queue/detail browser checks pass
at 390, 768, 1024, 1280, and 1440 pixels. A positive live admin follow-up
was not submitted to the demo data, so live persistence and retry still need
rehearsal before relying on this as an operational workflow.

The case-detail error seen in the demo admin portal was caused by bookings
returning zero rows under participant-only read policy, even though the case
itself was visible to admins. Migration `20261003115000_admin_case_detail_read_access.sql`
adds admin read access scoped to bookings with support cases and their payment
attempts. It is applied to the confirmed demo/test project. Live reads now
return the booking, participants, service, and available history; an unrelated
provider still sees zero booking and payment rows. The case detail browser
journey passes at the five supported widths. This does not grant admin write
access to booking or payment state.

Use one queue with status and owner, then a case detail with a chronological, source-labelled timeline. Admins need clear **review**, **request evidence**, **contact parties**, and **resolve/escalate** actions, each with a reason and a visible result. Do not expose raw card data or private files beyond the assigned case. Prevent duplicate submissions and require server authorization and immutable history for exceptional actions.

As product-design references, [Airbnb's Resolution Center](https://www.airbnb.com/help/article/767) exposes request status and escalation when parties do not agree, while its [issue guidance](https://www.airbnb.com/help/article/248) emphasizes documenting the problem and contacting the other party. TrabaWho should adopt the useful patterns, **not** Airbnb's deadlines, protections, or legal policy. Those require TrabaWho's own product and legal decisions.

## Edge-case matrix

The safe states below are intended requirements, not assertions that today's backend implements every transition. In all cases, payment truth comes from verified provider events; an admin may record a case but must not invent a successful payment or refund.

| Case | Next actor and safe handling | Evidence to retain | Policy decision still needed |
| --- | --- | --- | --- |
| Unpaid or expired checkout | Client retries on a valid slot; system expires the hold and releases capacity. Admin investigates only an ambiguous provider event. Never mark confirmed on browser return alone. | Hold expiry, checkout attempt, provider event, booking reference. | Retry window and whether a replacement slot is offered. |
| Unpaid down-payment balance after service | Client is prompted for the balance; provider/admin can open a case. Keep balance **due** and pause payout/closure until verified payment or an approved exception. | Original terms, deposit event, service evidence, reminders, communications. | Balance due date, collection path, late/no-payment consequences, who carries loss. |
| Provider no-show | Client reports issue; admin contacts provider and checks schedule/evidence. Do not auto-complete or pay out. | Appointment, chat, arrival/proof, responses. | Waiting period, reschedule/refund terms, provider penalty. |
| Client no-show | Provider reports issue; admin checks attendance and communications. Do not invent a delivered service or charge extra automatically. | Appointment, chat, arrival/proof, responses. | Grace period and cancellation/no-show fee. |
| Client disputes delivery or quality | Client opens case before completion deadline; provider responds; hold payout while contested. | Delivery proof, photos/files, agreed scope, messages, timeline. | Dispute window, evidence standard, remedy/partial refund rules. |
| Cancellation after payment | Route through cancellation policy and verified refund workflow; show pending, failed, or completed refund separately. | Policy snapshot, initiator, timestamps, original payment and refund IDs. | Fee allocation, cutoff, platform-fee refundability. |
| Failed, late, or duplicate provider event | System deduplicates by provider/event ID, reconciles attempt to booking, and queues ambiguity. Admin views discrepancy without forcing a paid state. | Signed event, attempt ID, provider reference, reconciliation result. | Reconciliation owner and escalation timing. |
| Refund fails or is reversed | Keep refund pending/failed; admin investigates and retries only through an idempotent provider operation. | Provider response, refund attempt, original charge, notifications. | Retry policy and customer communication timeline. |
| Chargeback | Freeze related payout/settlement, open case, submit permitted evidence through provider process. | Chargeback notice, payment, booking, delivery and message history. | Representment owner, fees and loss allocation. |
| Abusive or false report/review | Moderation triages report, preserves evidence, may temporarily hide content, and allows review/appeal. Do not silently hard-delete. | Report, original content, prior actions, appeal and rationale. | Content policy, privacy retention, appeal period. |

## Release gates

- **Two-day demo:** modern admin screens must render and existing account/review actions must still work; missing audit/report features are labelled unavailable. No production payment claim.
- **Before real-money launch:** settle the Phase 0 payment/cancellation decisions; implement verified refunds, payout ledger/reconciliation, dispute case handling, RLS and role tests, mandatory reasons, immutable audit, privacy/retention controls, and support ownership. Rehearse failed and duplicate events as well as the happy path.

## Dispute refunds: sandbox backend deployed

The case-detail implementation now offers an explicit **Approve full refund**
action, with a required decision reason and an irreversible-action confirmation.
Support follow-up remains a referral; it does not itself move money. Approved amounts
come from verified payment attempts and are submitted by a sandbox-only Edge Function.
Both participants can see refund progress and safe support next-step summaries;
internal notes remain private. The database closes the booking only after all refunds
are verified. Both migrations and the JWT-protected `process-booking-refunds` function
are deployed to the `.env` TrabaWho demo/test project. Participant reads, private
column protection, approval role checks, status checks, and admin support browser
journeys passed after deployment. Actual PayMongo sandbox refund issuance remains
untested. See [PayMongo rollout and verification](../integrations/paymongo.md).
