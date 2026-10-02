# Didit identity registration

Official references: [Create Session](https://docs.didit.me/sessions-api/create-session),
[Retrieve Session](https://docs.didit.me/sessions-api/retrieve-session),
[verification statuses](https://docs.didit.me/integration/verification-statuses), and
[webhooks](https://docs.didit.me/integration/webhooks).

## Registration and access

The form validates account type, document, credentials, full service address, and
both explicit consents. `create-didit-session` creates the configured workflow with
`POST https://verification.didit.me/v3/session/`, `callback_method: both`, and a
temporary signup reference. The browser receives the hosted URL and a random
nonce; only the nonce hash is stored on the server. Unfinished signup is preserved
in session storage. Finish in the original browser so its credentials and nonce
are available after cross-device verification.

The return bridge sends the browser to `/?check_verification=true#login`.
Provider `status` and `verificationSessionId` query values are informational.
`get_session` requires the saved nonce and retrieves
`GET /v3/session/{id}/decision/`. `create-unverified-user` revalidates the nonce,
email, account type, address, and consents. Only an approved overall decision can
proceed directly. `In Review` and duplicate identities enter the admin queue.
Client-submitted status and auto-approve environment overrides cannot approve a
registration. Declined, expired, and abandoned sessions cannot finalize.

Manual signup validates legal name, ID number, expiry, address, consents, and
JPEG/PNG/WebP images up to 7 MB each. The private `identity-manual` bucket stores
the front, back, and selfie evidence. Profile, review, claim, and finalized session
writes use one database transaction. Identity approval and email confirmation are
separate requirements; `is_verified` requires both. Account suspension/disable
status remains independent. Profile-load failure blocks access.

The `/register`, `#register`, and legacy `#identity-register` entry points share
the same registration steps, including the complete service address and both
consents. The legacy identity link must not open the retired form that omitted
location fields and used a different identity-consent property.

The provider's overall status covers every workflow check. Approved ID and face
nodes must not override an overall decline or review, for example an AML warning.
V3 reports use plural arrays such as `id_verifications`, `liveness_checks`, and
`face_matches`.

## Admin review

Open **Admin portal → Identity reviews**. Search by email, filter status, and page
through results. Review the full address, expiry, duplicate warnings, document
images, selfie, and current Didit report. Manual images use five-minute signed
links. Didit media is fetched server-side for authenticated admins.

Approval requires acknowledgement that evidence was reviewed and a reason of
20–2000 characters. Rejection also requires a reason and confirmation. The service
checks the admin's live role/account status. A service-only RPC locks the review
and atomically updates profile, claims, session, and immutable decision history.
Conflicting decisions fail; repeating the same operation is idempotent. Expired
documents cannot be approved.

Approval sends Supabase signup confirmation when the email is unconfirmed.
Delivery failure remains visible and can be retried. SMTP acceptance does not prove
inbox delivery. Explicit resend has a one-minute cooldown and a delivery lease;
retrying approval does not send duplicate mail. Rejection keeps access blocked and requires new valid evidence.
Public retries cannot change a confirmed account's password; those accounts need
support-assisted verification retry. Unconfirmed retries retain account restrictions.
Restoring account access does not approve identity. TrabaWho's decision controls
local access; it does not change Didit's provider report or impersonate a console
review.

## Configuration

Set these Supabase Edge Function secrets, never browser `VITE_*` variables:

| Secret | Purpose |
| --- | --- |
| `DIDIT_API_KEY` | Server-only provider access |
| `DIDIT_WORKFLOW_ID` | Explicit KYC workflow; invalid configuration fails instead of creating another workflow |
| `DIDIT_WEBHOOK_SECRET` | Destination's `secret_shared_key` |
| `IDENTITY_DOCUMENT_HASH_SECRET` | Stable document fingerprint HMAC key |
| `DIDIT_SESSION_NONCE_SECRET` | Signup nonce HMAC key |
| `TRABAWHO_APP_URL` | App origin and confirmation return URL |
| `IDENTITY_ALLOWED_ORIGINS` | Optional additional HTTPS callback origins, comma-separated |

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. Configure Auth SMTP, disable automatic email
confirmation, and allow the app's confirmation return URL. Localhost HTTP callbacks
support development. Browser configuration contains only the public Supabase URL
and anonymous/publishable key.

## Webhooks

Create a destination in Didit **API & Webhooks** for the public HTTPS
`/functions/v1/didit-webhook` endpoint, V3 payloads, and exact subscriptions
`status.updated` and `data.updated`. This destination is independent of the browser
callback. Store its signing secret in Supabase.

The handler checks `X-Signature-V2` over recursively sorted compact JSON with
Unicode preserved, or `X-Signature` over raw bytes. `X-Signature-Simple` is rejected
because it does not authenticate decision data. The signed body timestamp must
equal `X-Timestamp` and be within five minutes. `event_id` identifies retries;
event recording and application happen in one transaction. Failed writes return
an error and remain retryable. Older events and superseded sessions are ignored.

After signup, the session's `user_id` owns updates even though `vendor_data` is a
temporary reference. A pending local review stays held after later provider
approval. Decline and KYC expiry block access. Duplicate approved events preserve
email-confirmed access. Admin-only `integration_status` diagnostics check workflow
availability and webhook destinations without returning credentials.

## Deployment and verification

Apply the maintained identity migrations in order, then deploy
`create-didit-session`, `create-unverified-user`, `manual-identity-review`,
`admin-identity-review`, `verification-redirect`, and `didit-webhook` together.
Disable JWT gateway verification for the redirect and webhook. The admin function
also verifies tokens itself with `auth.getUser` and a database role check; an
anonymous key alone cannot authorize it.

Run `npm run check`, registration/admin identity Playwright journeys, and
`npx deno test supabase/functions/_shared/identityDomain_test.ts`:

```sh
npm run check
npx playwright test tests/e2e/registration-validation.e2e.spec.ts tests/e2e/identity-registration.e2e.spec.ts tests/e2e/identity-login-gate.e2e.spec.ts tests/e2e/admin-identity-review.e2e.spec.ts
npx deno test supabase/functions/_shared/identityDomain_test.ts
```

Run [`tests/integration/identity-registration.sql`](../../tests/integration/identity-registration.sql)
through a privileged connection to the linked test project. Its fixtures and
assertions run in a transaction and roll back. Database checks
cover address persistence, pending/rejected access, approval before/after email
confirmation, repeated/conflicting decisions, nonadmin denial, immutable history,
stale/duplicate events, and rollback on failed events. Use Didit's **Try Webhook**
and sandbox flows for signed approved/declined/review deliveries. A real camera
scan and inbox confirmation require separate verification from mocked tests.

The identity migrations through `20261004105000` and all six functions above are
deployed on the linked project. Live provider diagnostics returned HTTP 200 for the
configured workflow and destination list, with an active matching V3 destination
subscribed to both required events. Live session creation/polling and forged-status
rejection passed. Didit delivered a signed pending event; transactional application
and subsequent polling preserved its event timestamp and the session nonce.
Polling merges current metadata under the same lock as webhook and signup writes,
and cannot overwrite finalized local decisions. Synthetic manual signup, private evidence reads, admin approval
and rejection, idempotent retry, conflict rejection, and nonadmin denial passed;
the synthetic users and images were removed. A browser journey without API mocks
confirmed pending login denial, admin approval, and subsequent dashboard access.
Blocked login retains the entered email and its denial reason. Approval used synthetic email
confirmation to avoid sending external test email. These checks do not claim a
completed camera scan, signed approved/declined provider delivery, or inbox receipt.
Unfinished synthetic provider sessions and their event records remain for webhook
correlation; they created no auth accounts.
