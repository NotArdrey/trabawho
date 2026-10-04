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

### Actionable provider no-show workflow: demo/test schema deployed, rehearsal pending

Migrations `20261005112000_actionable_support_cases.sql`,
`20261005112100_case_replacement_and_refund.sql`, and
`20261005112200_case_remedy_events_and_review.sql`, plus the corresponding
client code, are in the working tree. The three migrations were applied to the
confirmed demo/test project `dczhfpcfqlygpbqjctwf` on October 3, 2026;
the unrelated pending email and identity migrations were not applied.
Because those two have earlier timestamps, a later full-repository `db push`
will report them as missing before the latest remote migration; review them
separately rather than repairing migration history or assuming they deployed.
Together they add admin ownership, a recipient-scoped case conversation,
private photo access, persistent in-app case alerts, a 24-hour provider response
target, a mutually accepted case-linked replacement visit, and a controlled
further-review request. The original appointment stays in history. Starting
replacement work still requires full verified payment and the accepted visit's
time; provider notes/evidence and client confirmation are required before the
case and booking complete. Admin no-show refund approval additionally requires
a provider response or elapsed review target and processed PayMongo **test**
payment events for every refundable attempt. The existing provider-backed
refund processor still decides whether a refund succeeded.

The 24-hour escalation is swept when the visible admin queue refreshes; it is
not a guaranteed background deadline until a hosted scheduler is configured.
Case messages and alerts are saved transactionally, so a failed save cannot
claim delivery. Email remains secondary and unverified; the configured SMTP
activation previously returned HTTP 403. The participant page now has a
dedicated case-detail view, with the reported issue, next step, conversation,
visit, refund progress, and review request separated. Existing internal admin
follow-ups remain private notes and are labelled accordingly. Seeded showcase
timeline entries are explicitly labelled as demonstration history, never as
provider payment evidence.

Local `npm run check` passed (401 tests), as did the existing admin/refund
Playwright journeys (13 tests) and the new case-conversation journey at 390,
768, 1024, 1280, and 1440px (5 tests). After deployment, the live admin
support journey passed at all five widths (6 tests). `npm run check:schema`
now reports zero schema mismatches; five unrelated or privileged tables remain
unverified by its anonymous read-only checks. Signed-in admin reads of case
messages, alerts, and visits succeeded; claiming an unassigned demo no-show
case succeeded. A signed-in client received `42501` when attempting the same
admin action and could read the case tables. This does not yet prove targeted
message visibility, private-image access, concurrency, or full remedy rules.
Rehearse client, provider, and admin actions on a genuinely paid test booking.
No live replacement visit, email receipt, or PayMongo sandbox refund has been
verified. Payouts, partial refunds, other dispute remedies, and production
policy remain out of scope.

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

### In progress: focused support-case workspace and evidence review

**Local frontend slice implemented; server policy and live rehearsal pending.**
The admin queue now opens a bookmarkable `/admin/support-cases/:caseId` page.
It loads the case by ID after refresh, preserves queue search/status in the
return URL, offers one **Open case** action per card, and separates Summary,
Evidence, Conversation, and Resolution. History and technical references are
secondary details. Report, delivery, and case-message images now use a shared
private in-app preview with signed-link loading, expiry/error states, and retry
for admins and participants. These source changes have not been claimed as a
deployed or fully rehearsed dispute workflow. The older dialog component
remains in the codebase temporarily but is no longer the queue's entry point.
Local `npm run check` passed (407 tests), as did the admin support and case
conversation Playwright journeys (11 tests across the documented widths).
These checks do not prove a live private-image preview, admin takeover, or a
PayMongo sandbox refund.

**Target behavior and work still to verify:**

- Replace the admin case dialog with a dedicated, bookmarkable
  `/admin/support-cases/:caseId` page and a clear return to
  `/admin/support-cases`. Preserve queue search and status filters in the URL.
  Load a case by its ID, not only from the currently loaded queue, so direct
  links and refresh work. Show a safe unavailable/permission state for an
  unknown or unauthorized case.
- Give queue cards one consistently placed **Open case** action. Remove the
  separate bottom **View evidence** action; evidence belongs in the case.
  Show one plain-language case status, owner, next actor, and response target
  rather than repeating overlapping status labels.
- Organize the case into **Summary**, **Evidence**, **Conversation**, and
  **Resolution** sections. Keep a compact case header and a contextual
  **Next action** area visible without making every record one long scroll.
  Summary holds the report, appointment, people, and payment-truth snapshot;
  Evidence groups report, provider, delivery, and message attachments;
  Conversation separates participant-visible updates from private admin notes;
  Resolution presents the available replacement/refund decision and its
  prerequisites. Put source-labelled history and technical IDs in a clearly
  labelled secondary disclosure. Show one primary action for the current
  state. On mobile, present one section at a time with an accessible section
  selector and an easy-to-reach next action. Keep page scrolling visible.
- Replace new-tab image opening in **both** admin and participant support
  views with one private, in-app preview dialog. Fetch a short-lived signed
  image URL on open, show the evidence source and timestamp, and handle
  loading, access denial, expiry, broken images, and retry. Trap and restore
  keyboard focus, support Escape, and fit images within small viewports without
  hiding important controls. A download is an explicit secondary action, not
  an automatic redirect.
- Make ownership meaningful: an unassigned case offers **Take ownership** in
  the Next action area, not as an unexplained button above the report. Require
  the assigned admin for outbound case updates, private follow-ups, replacement
  proposals, refund approval, and review decisions through server-side checks.
  Another admin may take over only with a reason; record an immutable event,
  notify the prior owner in-app, and reject stale concurrent owner changes.
  Preserve unsent drafts or warn before leaving the case.
- Clarify the existing PayMongo **test-mode** refund path. It already submits
  approved refunds through the provider API; this overhaul does not replace
  it or enable live-money refunds. Distinguish **payment verified**, **refund
  approved**, **submitted to PayMongo**, and provider-reported **pending**,
  **processing**, **succeeded**, or **failed**. Show the verified amount and
  reason before confirmation. Seeded timeline history is never payment proof;
  when provider payment evidence is missing, show **Payment verification
  needed** and block approval. Do not say money was returned merely because an
  admin approved the request. See [PayMongo refunds](https://docs.paymongo.com/docs/payment-acceptance-refunds)
  and [refund statuses](https://docs.paymongo.com/reference/refund-resource).

The first page slice hides case actions from a non-owner, but that is **not**
authorization. Existing security-definer RPCs can still assign an unclaimed
case while performing an action. Migration
`20261005112300_case_owner_enforcement.sql` is written locally to guard admin
messages, notes, replacement proposals, refund approvals, review decisions,
and implicit ownership changes; it also adds reasoned, audited takeover and
limits participant reads of internal support audit notes. It is **not applied
or live-verified**. Direct RPC tests for wrong owner, unclaimed cases, stale
takeovers, closed-case review, and prior-owner notification must pass before
the UI can expose takeover or claim that owner enforcement is active. Drafts
survive switching case sections, but leaving the page with unsent text still
needs a warning. Do not apply the migration by itself: the admin page still
needs the takeover form and an explicit ownership route for closed cases with
pending further-review requests.

Use established marketplace flows as **design references, not TrabaWho
policies**: [Airbnb's issue guidance](https://www.airbnb.com/help/article/248)
emphasizes documentation, communication, and escalation;
[Taskrabbit's communication](https://support.taskrabbit.com/hc/en-us/articles/46260405727771-Communication-After-Task-Invite-Policy)
and [rescheduling](https://support.taskrabbit.com/hc/en-us/articles/46260435128091-Schedule-Availability-Reschedule-Policy)
guidance supports in-app records and mutual agreement; and
[Upwork's work review flow](https://support.upwork.com/hc/en-us/articles/17974824831507--Review-and-pay-for-fixed-price-contracts-and-milestones)
separates submission, review, and decisions. Do **not** copy their deadlines,
escrow arrangement, liability findings, or refund policy.

Before considering this planned overhaul complete, run `npm run check` and the
relevant admin/participant Playwright journeys at 390, 768, 1024, 1280, and
1440px. Cover direct links, Back/Forward, queue-filter preservation, focus and
keyboard access, missing/unauthorized cases, draft loss, private evidence,
expired preview URLs, non-owner and wrong-role rejection, takeover races,
refund status/failure, and one primary action per state. Rehearse a genuinely
paid PayMongo test booking through a provider-status check; record any step
that cannot be verified. Production refunds, payouts, partial-refund policy,
and other dispute remedies remain separate work.

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

## Participant case alerts and navigation: local changes

The notification bell now reads booking-case notices alongside booking and chat
updates. Case notices link to the exact participant case conversation; booking
updates filter to the affected booking, and chat updates open the matching
thread. Opening a case marks its notices read through the existing server RPC.
The support-case list keeps its content visible during background refreshes
and no longer inserts a recurring status line above the filters.

Migration `20261005112400_case_open_participant_notifications.sql` is **local
only, not deployed or live-verified**. It would notify the other booking
participant when a new case opens; the reporter is not alerted about their own
report. Existing participant-directed case messages and remedy events already
write case notices. Private admin notes still do not notify participants. No
historical notices are backfilled. Apply the migration only to the confirmed
demo/test project after the pending support migrations and role/RLS checks are
resolved, then verify client and provider alerts with separate accounts.
