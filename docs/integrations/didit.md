# Didit identity registration

Official references: [Create Session](https://docs.didit.me/sessions-api/create-session),
[Retrieve Session](https://docs.didit.me/sessions-api/retrieve-session),
[verification statuses](https://docs.didit.me/integration/verification-statuses), and
[webhooks](https://docs.didit.me/integration/webhooks).

## Implementation and rollout

The initial registration redesign is implemented in the repository. Its six migrations
and eight new or updated backend functions are deployed on the linked Supabase
project. The new account-owned endpoints run alongside the earlier endpoints.
Existing identity-reviewed names are not backfilled or silently corrected.
The subsequent fixed-account-role change adds two migrations and updated
function code. Both migrations and seven affected functions are deployed on the
linked project. The registration follow-up was published on 2026-10-05: the
`account-registration` function is active at version 5, and the frontend is live
at [TrabaWho](https://trabawho-kappa.vercel.app). This follow-up requires no schema
migration or changes to confirmation or identity gates.

The subsequent account-access correction was deployed to `account-registration`,
`account-didit-session`, `account-manual-review`, `account-identity-name`, and
`provider-setup`. A failed profile read is retried once; persistent lookup failures
return a retry message (503), and a missing profile returns an unavailable-profile
message (409). Only non-active account statuses return the restriction message
(403). Active accounts can resume registration regardless of identity approval,
and confirmed existing accounts without a registration record retain legacy
sign-in access. This backend correction changes no account or verification data.
Verification passed the full quality gate (525 unit tests and 42 standards/backend
tests), the three production login/logout and signup-reset journeys, and a live
confirmed legacy-account state request. The temporary live probe account was
removed after verification.

The identity-first follow-up adds `20261006108000_identity_before_email_confirmation.sql`
and changes `account-registration`, `account-didit-session`, `account-manual-review`,
and `account-identity-name` plus their shared helpers. Apply this migration and
redeploy these functions together before publishing the new frontend. These changes
are prepared locally; deployment is not recorded as completed here.

## Account and email

`/register`, `#register`, and `#identity-register` open the same base-account
journey. It starts with an explicit **Client — Book a service** or
**Worker — Offer services** choice, with neither preselected, then collects email,
password, password confirmation, and Terms and Conditions agreement. It does
not ask for a document type, legal name, or service address at this stage.
The visible steps are **Account → Name → Identity**. Account creation leaves
email unconfirmed and sends no confirmation email. The second step collects the
complete applicant name; `account-registration` validates the recovery capability
or authenticated session and saves unverified `user_metadata.signup_name`.
Saving or revisiting a name never modifies the protected profile name or approves
identity. Identity approval, including the verified-name check or administrator
review, atomically confirms email through the server-only profile access guard.
Declined, pending, duplicate, and expired identities remain blocked. Email is not
a wizard page. Back appears below the primary action, and account-access tabs
hide once registration has started. The registration scrollbar is hidden while
native scrolling and keyboard access remain available.
Terms and Conditions opens an accessible modal from the agreement's text link.
Sign in precedes Create an account in the account-access navigation.
The server validates the choice, saves it in protected Auth app metadata as
`signup_role`, and persists the fixed account type in
`account_registrations.account_role`. Profile role and capabilities match that
type from creation. Older bundles that omit the type create Client accounts.
Existing accounts keep their current profile role when the migration runs.
Capabilities, current identity claims, and pending reviews are aligned with that
role, including Workers previously promoted from Client. Completed review
records and verified names remain historical.

One person may have **one Client account and one separate Worker account**.
Each has its own login email, profile, and verification journey. The account type
cannot switch after registration. Clients book services; Workers complete provider
setup and offer services. Navigation and booking/chat scope stay in the account's
role; opening an incompatible dashboard, booking, or setup URL returns to its own
home. To use the other role, sign out and register a separate account.

Identity document fingerprints are checked **within the account role**. The same
ID can verify one Client and one Worker account. A second account with that ID
and the same role goes to review and cannot be approved, including through an
admin decision. A partial unique index makes competing approvals atomic. This
checks the matching document fingerprint; it does not establish that different
IDs belong to the same person. Existing-email signup remains rejected because
Supabase Auth uses a unique email for each account.

`account-registration` creates an unconfirmed Auth account and initializes its
restricted profile and `account_registrations` record. Profile initialization and
consent/recovery metadata are transactional. A failed initialization removes the
new Auth account. An existing email cannot have its password replaced through
registration. Creation does not depend on SMTP delivery.

An expiring recovery capability permits only registration state, applicant-name
entry, and identity actions before email confirmation. Handlers validate its hash,
expiry, and live account status; it cannot authorize marketplace operations.
The recovery window is 14 days to cover the seven-day manual review period.
Expired capabilities require support recovery; after identity approval users can
sign in normally. Existing resend/change-email actions remain for older bundles.
Confirmation callbacks still return to `/register` for those earlier accounts.

The page polls active identity sessions and pending reviews every five seconds
while visible and refreshes when the user returns. When a capability-owned account
is ready, a server-generated and redeemed Auth token creates its session without
storing a password or sending a confirmation email. The service client is kept
separate from the client redeeming the token. The browser persists the returned
Auth session and clears the pending recovery capability.

The pending account ID, expiring recovery capability, email, and entered signup
name are stored
in session storage. The retired password-bearing signup state is removed. Auth
credentials are never saved by the registration journey; normal Supabase Auth
session persistence continues to support returning users.

Successful sign-in or authenticated session restoration clears older pending
recovery. All application logout paths clear pending and retired signup storage
after successful sign-out. Unsigned page refresh still preserves the current
pending signup. Registration listens for sign-out to clear its in-memory state;
an earlier restoration request cannot repopulate the screen after logout.
**Register another account** abandons the browser's pending journey without
deleting the server account or sending another email. Signed-in applicants can
use **Sign out and register another account** to start a fresh signup.

Back navigation revisits completed steps without creating another account,
resending email, or clearing the current form. A created account shows an
account summary; a confirmed email shows its completed state. Verification of
the name extracted from the ID remains part of the final Identity step.

The updated `account-registration` function was deployed before the frontend.
Live endpoint checks verified nonce rejection and successful signup-name saving
without changing confirmation delivery, protected names, identity gates, or
account roles. The temporary verification account was removed afterward.
All 22 registration Playwright journeys passed against the production frontend,
including a real login/logout cycle followed by an empty new-account form, modal
keyboard focus, Back navigation, and all five documented responsive widths.

## Identity and name confirmation

`account-didit-session` authenticates the account using `auth.getUser`, checks its
live account restrictions and confirmed email, and requires identity consent
before creating a hosted workflow. Didit handles document selection, ID capture,
liveness, and face matching. Session creation has a database lease, and the
session belongs to the account from the start. Retries reuse the current pending
session; returns and polling resume it across devices after sign-in.

Existing ID-photo upload is controlled by the Didit workflow's **ID verification
→ Advanced → Document upload** option, not a TrabaWho form field or session
parameter. Enable it in the configured workflow if uploads should be offered;
live selfie/liveness checks remain independent. The UI describes uploads
conditionally because the configured workflow has not been changed by this code.
See [Didit's document upload guidance](https://help.didit.me/documents-coverage/document-upload-problems).
Manual review remains the clearly labeled upload fallback.

Email verification occurs before identity verification. The confirmation link
proves inbox access; an identity-review decision notification follows the admin
decision and does not replace email verification.

The browser return bridge preserves an allowlisted `/register` destination.
Callback status and session query parameters are informational. Polling fetches
`GET /v3/session/{id}/decision/` on the server. The overall decision controls
access; approved ID/face nodes cannot override an overall decline or review.
V3 reports use plural arrays such as `id_verifications`, `liveness_checks`, and
`face_matches`.

Server-fetched reports supply the complete legal name and document type. The
profile remains restricted after provider approval until the user confirms
**Name on your verified ID** through `account-identity-name`. The protected
`full_name` uses the complete source value without a forced first/middle/last
split. Missing names or document types, incomplete/conflicting extracted names,
duplicates, disputed names, and overall review decisions enter the admin queue.

A requested correction remains separate from the source name. It never becomes
verified automatically. `identity_name_actions` records confirmations, correction
requests, and reviewed names as immutable audit entries. An approved later
webhook cannot bypass pending local review. A changed source name after user
confirmation requires review while preserving the existing protected profile name.
Later approvals preserve completed admin corrections when the source evidence
has not changed. Local correction requests do not overwrite the provider decision.
Decline, abandonment, expiry, suspension, and disable status continue to block
access. Duplicate/stale events and superseded sessions cannot open access.

## Manual fallback

The identity screen provides a clearly labeled manual fallback, including when
an unfinished hosted workflow cannot verify a document. It reuses the same
confirmed account. It collects the document type, name shown on the document,
number, expiry if shown, front/back images, selfie, and identity consent. A
successful Didit journey does not request a second ID upload.

`account-manual-review` accepts JPEG/PNG/WebP evidence up to 7 MB per image and
stores it in the private `identity-manual` bucket. Evidence, review, claim, and
profile writes are checked server-side; failed submissions remove uploaded
files. The submitted name is a review request, not a verified profile name.
Manual profile/review/claim/session changes use one database transaction.
Retries follow the local decision and expiry, so a completed admin rejection can
use manual review even when Didit still reports approval. Submitting manual review
revokes any in-flight hosted-session creation lease and clears stale name approval
flags while preserving the protected profile name and immutable name history.

## Marketplace setup and access

The UI distinguishes email pending, identity pending/in progress, name pending,
identity review, declined, and ready states. Dashboard refresh sends pending V2
accounts to registration. Profile-load failure blocks access. Database guards
also require confirmed email and either source-name confirmation or an approved
reviewed name before a V2 profile can become verified.

Worker-only provider setup collects service area and gig details after the gates. It displays
the verified name without a self-service edit. `provider-setup` saves the provider,
seller, first gig, and completion flag in one transaction. An active gig cannot
be published for a V2 account until email/identity approval and provider setup
are complete. Expiry is checked at setup, publication, and checkout, including
before an expiry webhook arrives. Identity restrictions deactivate existing V2
listings; clearing a restriction does not automatically republish them.
The provider service area remains distinct from a precise booking
address. Existing accounts retain their recorded role and identity decision; role
conversion and using the opposite role now require a separate account.

Client-only booking checkout collects the province, city/municipality, barangay, and precise
service address. Inquiry conversations can start before a precise address is
needed; their checkout collects it later. `start_booking_checkout_with_address`
locks the profile, saves the address, reserves checkout, and captures the booking's
address snapshot in one transaction. A failed checkout rolls back its address
write. Retries and later balance payments preserve the original booking snapshot.
The earlier checkout RPC remains available through the same V2 access gate.

## Admin review

Open **Admin portal → Identity reviews**. Search by email, filter status, and
page through results. Review expiry, duplicate warnings, evidence, and the live
Didit report. Manual images use five-minute signed links. V2 review details show
the source name, requested correction, and reason for review separately; a service
address is not described as identity evidence.

V2 approval additionally requires the complete legal name verified from the
evidence. Approval requires acknowledgement and a reason of 20–2000 characters;
rejection requires a reason and confirmation. `account-admin-identity-review`
checks the administrator's live role/account status. Its service-only RPC updates
profile, claims, session, review decision, and immutable name/decision history
atomically. A requested correction alone cannot support approval. Expired
documents cannot be approved. Repeated operations are idempotent; conflicting
names or decisions fail. Existing V1 review decisions keep their established
behavior and do not overwrite names.

## Webhook security

The public HTTPS `didit-webhook` destination uses V3 payloads and exact
subscriptions `status.updated` and `data.updated`. It is independent of the browser
callback. The handler checks `X-Signature-V2` over sorted compact JSON, or
`X-Signature` over raw bytes. `X-Signature-Simple` is rejected. The signed body
timestamp must match `X-Timestamp` and be within five minutes. Event recording and
application are atomic; failed writes remain retryable. Earlier V1 sessions and
reviewed accounts continue through the legacy event branch.

## Configuration and deployment

Server-only secrets are `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`,
`DIDIT_WEBHOOK_SECRET`, `IDENTITY_DOCUMENT_HASH_SECRET`,
`DIDIT_SESSION_NONCE_SECRET`, `TRABAWHO_APP_URL`, and optional
`IDENTITY_ALLOWED_ORIGINS`. Supabase supplies its URL, anonymous key, and service
role key. Browser configuration contains only the public URL/key. Auth email
confirmation remains enabled globally. Version 2 accounts are confirmed automatically
only upon final identity approval; legacy email confirmation behavior is retained. The confirmation
allowlist must include the application origin's `/register` route; existing `/**`
entries also cover it.

Apply the maintained identity/email migrations followed by:

- `20261006100000_account_registration.sql`
- `20261006101000_registration_review_marketplace.sql`
- `20261006102000_booking_address_checkout.sql`
- `20261006103000_pending_registration_email.sql`
- `20261006104000_registration_event_gate_hardening.sql`
- `20261006105000_registration_retry_hardening.sql`
- `20261006106000_fixed_account_roles.sql`
- `20261006107000_identity_duplicates_per_role.sql`
- `20261006108000_identity_before_email_confirmation.sql`

Deploy `account-registration`, `account-didit-session`, `account-identity-name`,
`account-manual-review`, `account-admin-identity-review`, `provider-setup`,
`didit-webhook`, and `create-paymongo-checkout`. JWT gateway verification is
disabled; protected actions validate tokens and live account/admin access inside
their handlers. Keep the earlier identity endpoints available until the production
frontend has been published with the new endpoint names.

The fixed-account-role update requires both new migrations and redeployment of
`account-registration` and all endpoints importing the shared
`accountRegistration.ts` helper, before publishing the frontend. The unique index
rejects existing same-document/same-role approved conflicts instead of silently
modifying users; resolve any such conflicts before applying the migration.

## Verification record

The fixed-role change is exercised against real PostgreSQL migrations in an
isolated PGlite database through `npm run test:standards`. Coverage includes one
approved account per document per role, manual review roles, admin duplicate
approval rollback, immutable account types, opposite-role writes/checkout denial,
existing Worker migration compatibility, and successful Worker setup and Client
checkout. These tests do not modify the linked project. `npm run check` passed
with 478 unit tests and 20 standards/database tests. All 70 selected browser
journeys passed, covering fixed navigation, incompatible
URL redirects at all five supported widths, registration, identity recovery,
Worker setup, incoming messages, and Client checkout. Backend helper tests also
passed (10 tests).

The fixed-role backend rollout was completed using the PAT from the ignored
`.env` file. Both migrations are recorded in the linked project's migration
history. The seven affected Edge Functions are active; protected endpoints reject
anonymous requests and the webhook rejects unsigned requests with HTTP 401.
Live profile capabilities match their account roles. Rollback-only SQL suites
`account-registration.sql` and `account-roles.sql` passed, including same-ID
approval across roles, duplicate admin-approval rollback, fixed role enforcement,
and opposite-role setup/checkout denial. All synthetic accounts and test events
were rolled back. The deployment did not change email confirmation or the Didit
workflow configuration.

On 2026-10-04, `npm run check` passed with 424 unit tests and 14 standards checks.
All 74 selected Playwright journeys passed, covering the new base
account, email recovery, Didit/name gates, correction review, manual fallback,
cross-device resumption, dashboard denial, provider setup, and booking-address
collection. Rollback-only live SQL suites cover account registration, legacy
identity behavior, and email notifications. The account suite also covers
creation leases, the then-current duplicate rules, name/decision replay, protected names,
provider publication, manual rejection, retries after admin rejection, stale
creation/approval denial after manual fallback, expiry gates, and address rollback.

A separately authorized diagnostic verified actual Gmail inbox receipt and the
new confirmation link's HTTP 303 return to `/register` on the allowed local app
origin. Confirmed email kept identity pending. Live account-owned Didit creation,
repeat-session reuse, polling, identity-consent denial, and premature/forged
approval denial passed. The synthetic Auth account was removed; its unfinished
provider session remains for webhook correlation. Anonymous requests to every
protected V2 identity/admin endpoint returned 401. A further Native Auth diagnostic
confirmed that changing the pending email preserves the account and password,
rejects the old confirmation link and old email login, accepts the new link and
new email login, and leaves identity pending. Its synthetic account was removed.

A real camera scan and signed approved/declined provider deliveries still require
a human rehearsal. Automated tests and a signed pending event do not establish
that a real ID/selfie scan has passed. Frontend publishing was excluded at the
user's request; the backend deployment alone does not update the live form.

```sh
npm run check
npx playwright test tests/e2e/registration-validation.e2e.spec.ts tests/e2e/identity-registration.e2e.spec.ts tests/e2e/identity-login-gate.e2e.spec.ts tests/e2e/admin-identity-review.e2e.spec.ts tests/e2e/provider-setup.e2e.spec.ts tests/e2e/booking-payment-chat.e2e.spec.ts tests/e2e/ai-redesign-smoke.e2e.spec.ts
npx deno test --allow-env --allow-net supabase/functions/_shared/identityDomain_test.ts supabase/functions/_shared/accountRegistration_test.ts
```

Run `tests/integration/account-registration.sql`, `tests/integration/account-roles.sql`,
`tests/integration/identity-registration.sql`, and
`tests/integration/email-notifications.sql` through a privileged linked-project
connection; each suite rolls its fixtures back.
