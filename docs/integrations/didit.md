# Didit identity registration

Official references: [Create Session](https://docs.didit.me/sessions-api/create-session),
[Retrieve Session](https://docs.didit.me/sessions-api/retrieve-session),
[verification statuses](https://docs.didit.me/integration/verification-statuses), and
[webhooks](https://docs.didit.me/integration/webhooks).

## Current registration flow

**Account Details → Identity Verification → Identity Review → Email Verification**.

Registration collects an explicit Client or Worker choice, email, password,
password confirmation, and Terms and Conditions agreement. Neither role is
preselected. It does not ask for identity evidence, legal name, or service address
at this stage. `/register`, `#register`, and `#identity-register` use this journey.

The frontend requests the maintained `registrationVersion: 3` draft flow. The server
saves the account role and encrypted sign-in details with a recovery capability,
then opens Didit or manual evidence submission. It sends no confirmation email at
this stage. Trusted identity evidence creates an unconfirmed Auth account and a
pending administrator review; an approved provider result cannot open access.

Administrator approval starts the final **Confirm your email** step and requests
the Supabase Auth signup confirmation link. The screen explains the inbox link and
provides resend/change-email actions. SMTP failure preserves the saved review and
account for retry. The durable notification worker retries failed approval email.
The confirmation link returns to `/register`; polling and focus refresh detect
confirmation, including confirmation on another device. The user can also sign in
with the confirmed email/password to finish. Sign-in resend returns a uniform
response and sends only for active, approved, unexpired identities (or legacy
accounts without an identity requirement). Registration resends retain rate limits,
expiry checks, and nonce validation. Changing email atomically revokes the old link.

Marketplace access requires confirmed email and approved identity with a reviewed
legal name. Button presses, callback parameters, provider decisions, and recovery
capabilities cannot confirm email or bypass administrator review. Identity review
notifications are separate from signup email confirmation. Accounts that already
confirmed their email in the preceding rollout do not need another link.

## Recovery and compatibility

Browser form entries and unsigned recovery capabilities exist only in memory.
Passwords never enter browser storage, logs, or Didit payloads. Leaving or reloading
clears the form. Unfinished drafts can start again; submitted accounts finish through
review and the emailed confirmation link before signing in.
Sign-out removes protected client state and retired registration storage. Closing
an unfinished Didit scan resets the form. Completed submissions remain in the
administrator queue and can finish by signed webhook.

Already-issued V2/V3 registrations retain their database contracts. New submissions
use the maintained V3 identity-first draft process, including requests from older
frontend bundles. Existing V4 accounts can capture identity before confirming email,
but still require human review and inbox ownership before access. V3 credentials
are AES-GCM encrypted, bound to the draft UUID, and removed at finalization/discard.
Draft recovery expires after 14 days; retain the nonce secret during that window.
Existing confirmed accounts retain their roles and identity decisions. The correction
uses a new migration; previously applied SQL and existing verification data are unchanged.

## Identity verification and names

Account-owned Didit, manual, and name actions validate live account access/recovery
ownership. Identity capture does not require confirmed email; confirmation delivery
for current and V4 registrations is gated on local approval. Recovery grants
registration access only. Session creation leases prevent duplicate hosted sessions.

Didit handles ID selection/capture, liveness, face matching, and legal-name extraction.
It runs in a camera-enabled dialog using the
[official iframe integration](https://github.com/didit-protocol/iframe-example).
The active frame's origin and message source are checked before querying trusted
server results. Messages and callback parameters cannot approve a user. The server
polls `GET /v3/session/{id}/decision/`; the overall decision controls access. V3
reports use plural arrays such as `id_verifications`, `liveness_checks`, and
`face_matches`. Numeric and ISO timestamps are normalized before event ordering.
Duplicate, stale, and superseded events cannot replace completed human decisions.

Photo uploads depend on the Didit workflow's **ID verification → Advanced → Document
upload** setting. The app does not change that setting; see
[Didit's upload guidance](https://help.didit.me/documents-coverage/document-upload-problems).
ID/selfie consent is explained beside each verification action and recorded when
selected. There is no separate identity consent checkbox.

Manual fallback accepts JPEG/PNG/WebP images up to 7 MB each: ID front, back when
applicable, and selfie holding ID. It collects name on ID, document type, number,
expiration or no-expiration choice, and evidence consent. Images use the private
`identity-manual` bucket. Failed submissions remove uploaded files. Review, claim,
profile, and session updates are transactional. Didit success does not request another
manual upload. Retry eligibility follows local decisions and expiry; manual fallback
revokes stale session-creation leases.

Extracted complete legal names remain separate from correction requests. Trusted
confirmation for older accounts or administrator approval updates protected profile
names. `identity_name_actions` keeps immutable audits. Missing/ambiguous names,
duplicates, and disputed evidence stay visible to reviewers. Source-name changes
after approval require review while preserving the protected profile name.

## Roles, review, and marketplace access

A person can have one Client and one separate Worker account, each with its own email
and verification journey. Roles cannot switch. Fingerprints are unique within the
role: one ID can verify one Client and one Worker, but cannot approve a second account
of the same role. A partial unique index enforces concurrent approvals. Matching
fingerprints do not establish that different IDs belong to one person.

Open **Admin portal → Identity reviews** to search, filter, and page through submissions.
Review expiry, duplicates, source names, corrections, evidence, and live Didit reports.
Manual images use five-minute signed links. Approval requires a complete verified
legal name, acknowledgement, and a reason of 20–2000 characters. Decisions/evidence
access are audited. The durable notification worker sends review decisions; Supabase
Auth SMTP sends email confirmation links.

Worker setup collects service area and gig information after both gates. Client
checkout collects province, city/municipality, barangay, and precise service address.
Address/checkout writes are transactional; retries preserve booking snapshots.
Expiry and account restrictions are enforced server-side at setup, publication,
and checkout. Clearing a restriction does not automatically republish listings.

## Configuration and rollout

Server secrets: `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET`,
`IDENTITY_DOCUMENT_HASH_SECRET`, `DIDIT_SESSION_NONCE_SECRET`, `TRABAWHO_APP_URL`,
and optional `IDENTITY_ALLOWED_ORIGINS`. Supabase supplies its URL and Auth keys.
Browser configuration contains only the public URL/anonymous key. Keep Auth email
confirmation enabled and allow the application's `/register` return URL.

The review-before-email correction was deployed on 2026-10-07 (Philippine time).
Migration `20261007120000_registration_review_before_email.sql` matches the maintained
source, all eight affected functions are active, and Auth templates match the generated
designs. SMTP credentials, confirmation requirements, and redirects are preserved.
The preceding email-first migration remains in history. For subsequent environments,
apply the maintained migrations through
`20261007100000_email_first_registration.sql` before running:

```sh
node scripts/deploy-registration-fix.mts --review-before-email
node scripts/deploy-registration-fix.mts --review-before-email --apply
npm run email:design -- --apply
```

The first command validates dependencies and prints a manifest without remote changes.
The second applies only this migration, checks migration history, and deploys
registration, Didit, manual, name, admin review, webhook, email worker, and provider
setup bundles. The third publishes updated Auth email copy; see [email setup](email.md).
SMTP settings are preserved. Gateway JWT verification stays disabled; handlers
validate Auth tokens, recovery ownership, administrator access, or webhook signatures.
Coordinate backend and frontend rollout.

Live rollback checks pass for Client and Worker identity capture before confirmation,
provider approval waiting for an administrator, early resend/change-email denial,
and human approval leaving access blocked until inbox confirmation. Existing account,
role, and draft suites pass compatibility checks. Protected endpoints reject anonymous
requests. A deployed API probe saved an encrypted draft without creating Auth or
sending email, erased its credentials on discard, and removed the temporary draft.
These checks do not establish inbox delivery or a real Didit scan.

## Verification

Run `npm run check` and registration, identity-access, and admin-review Playwright
journeys. Tests cover email pending, resend, changed address, another-device sign-in,
Back navigation, forged callback status, administrator gates, legacy compatibility,
role separation, and supported viewport widths. Database tests run real migrations
in isolated PGlite without linked-project changes. Browser fixtures mock Auth and
Didit; they do not prove inbox delivery or a real camera/ID/selfie scan. Those require
a deployed human rehearsal.
