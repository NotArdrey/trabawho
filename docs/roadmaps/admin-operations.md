# Admin Operations Roadmap

## Purpose and current boundary

This is the minimum operational scope for a trustworthy TrabaWho marketplace. It is a requirements roadmap, not a claim that refunds, payouts, or dispute resolution work today. The presentation uses PayMongo test mode only. Production payment activation remains gated by the decisions in the [booking and payment roadmap](booking-transactions.md).

The admin experience should prioritize **work requiring a decision** over decorative metrics. A useful overview begins with cases awaiting review, failed payment events, and unresolved access reports, each linking to the underlying booking or account. Counts must come from a real query; unavailable data must be labelled unavailable, never shown as zero.

## Capability inventory and priority

| Priority | Capability | Current state | Minimum behavior to build |
| --- | --- | --- | --- |
| Demo | Account search, role changes, disable/suspend/restore | **Available** | Keep server-backed feedback, reason capture, and role guard; verify RLS and privileged-action audit before production. |
| Demo | Review list and deletion | **Partial** | Recent reviews load; deletion is permanent. Add reports, policy reason, non-destructive hide/restore, and audit before operational use. |
| Demo | Admin audit page | **Not built** | Existing page must say the feed is unavailable; connect actor, target, reason, time, and outcome before claiming to show history. |
| P0 | Searchable booking/support queue | **Partial** | A read-only queue lists the latest 50 submitted booking cases and can open private image evidence. Add search by booking reference, client, provider, and status; show the next actor, age, and urgency; filter payment, delivery, dispute, and cancellation issues. |
| P0 | Booking case detail | **Partial** | Case reason and evidence are available, but join booking timeline, participants, schedule, chat/evidence references, payment attempts and provider events; distinguish reported, verified, and disputed facts. |
| P0 | Payment exception queue | **Not built** | Surface expired holds, failed or ambiguous checkout, mismatched webhooks, unpaid balance, refund failure, and chargebacks without manually changing money state. |
| P0 | Dispute intake and triage | **Partial** | Booking-scoped reports persist with optional private evidence. A versioned service-policy snapshot routes an in-window designated repair report to provider rework request and exceptions to support review. This is only routing, not a defect decision or refund. Add structured provider response, owner, deadlines, remedy authority, and status history. |
| P0 | Immutable admin activity | **Partial** | Booking audit events exist; platform-wide admin actions are not exposed as a verified feed. Record reason, actor, target, before/after, and operation ID server-side. |
| P1 | Resolution and appeals | **Not built** | Record a policy-backed outcome, notify both parties, preserve evidence, and allow a controlled appeal/review path. Never directly set paid/refunded from the UI. |
| P1 | Refund and payout operations | **Not built** | Use provider-confirmed refund/payout events, reconciliation, failure retries, and clear hold/release rules. No manual balance edits. |
| P1 | Report and moderation queue | **Not built** | Accept review/profile/chat reports, preserve original evidence, hide content reversibly, document reason, and support appeal. |
| P2 | Operational analytics | **Not built** | Add trends only after event definitions and reliable queries exist; no illustrative charts masquerading as live data. |

## Case-handling experience

The October 2 demo/test implementation adds the read-only case queue and
private evidence access. It does **not** grant admins a refund, payout, or
payment-override action. A test no-show report was visible to the admin after
submission. PayMongo test checkout was recoverable through server-side API
verification, but the webhook still did not automatically record two fresh
payments; a payment exception/reconciliation queue remains P0.

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
