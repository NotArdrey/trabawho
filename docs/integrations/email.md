# System email

TrabaWho uses `official.trabawho@gmail.com` through Gmail SMTP over TLS on port
465. The app password belongs in ignored `supabase/.env.local` and Supabase
secrets. Never prefix it with `VITE_` or place it in browser code.

## Activation

Copy `supabase/.env.example` to `supabase/.env.local` and supply `SMTP_PASSWORD`.
Use a `SUPABASE_ACCESS_TOKEN` with access to the linked project in the shell or an
ignored environment file; `PAT` in `.env` is also supported. The command reads
`.env`, `.env.local`, and `supabase/.env.local`, with shell values taking priority.
If an inherited CLI token receives 401/403, a read-only preflight tries the local
project token before any remote changes. Then run:

```sh
npm run email:configure
```

The command verifies project access, uploads server secrets, deploys
`send-system-emails`, applies only the email migration and records it in migration
history, configures the worker's Vault credentials and minute scheduler, and
updates Auth SMTP. Repeated runs preserve the worker secret. Existing Auth email
hooks require review because they override custom SMTP. Auth confirmation rules,
redirect allowlists, templates and rate limits are preserved.

Hosted activation completed on 2026-10-04. The inherited CLI token lacked project
access; the local project token succeeded. Auth SMTP, server secrets, the email
migration, worker, Vault credentials, and minute scheduler are deployed. The
Management API requires `smtp_port` as the string `"465"`; the setup command now
uses that contract rather than a number, which was rejected with HTTP 400.

Auth's site URL now points to `https://trabawho-kappa.vercel.app`; its redirect
allowlist includes that origin and the localhost/127.0.0.1 development origins on
port 3000. The default Auth email limit of two requests per hour was increased to
30 for this project. These project settings were corrected during activation;
re-running the command preserves them.

A permitted diagnostic signup confirmation reached the sender's Gmail inbox.
Following its actual link confirmed the synthetic account and returned to the
deployed app's login screen. Identity remained unverified and access stayed
blocked. The synthetic account was removed. The hosted notification worker also
processed five queued events with zero delivery failures; this records SMTP
acceptance, not inbox receipt for those notifications. Both live transaction-
rollback integration suites passed, including email recipients, leases, privacy,
identity decisions, and name protection. A real camera verification still needs
separate rehearsal.

## Email design

System notifications and the six Supabase Auth templates share the TrabaWho
wordmark, white card, blue action button, readable details, and plain-language
instructions. Presentation tables and inline styles support email clients without
loading app CSS, images, fonts, or scripts. Notifications retain a plain-text part.
Identity updates explain the review and email-confirmation steps separately;
they omit internal account UUIDs. Authentication templates preserve Supabase's
`{{ .ConfirmationURL }}` and `{{ .Token }}` placeholders and include a fallback link.

The final registration screen identifies the confirmation email by its subject,
`TrabaWho: Confirm your email`, and tells users to click its blue **Confirm my email**
button. That button uses Supabase's secure signup verification URL, with a copyable
fallback link. Confirmation is sent after identity approval; accounts awaiting
manual review receive it after administrator approval. A read-only check on
2026-10-06 verified that the hosted confirmation template has the button and secure
URL placeholder, with email confirmation required and no overriding email hook.
This check did not send an email or establish actual inbox delivery.

Run `npm run email:design` to generate reviewable HTML in `exports/email-design`.
After verification, run `npm run email:design -- --apply` to deploy the notification
worker and update only Auth subjects and template content using the environment
PAT. SMTP credentials, confirmation gates, redirect settings, schedules, and stored
data are preserved. The command rejects an active email hook or custom callback
templates that need their own integration. Re-running `email:configure` also
includes the shared layout in the worker deployment.

Verify with the existing Deno email suites and
`npx playwright test tests/e2e/email-design.e2e.spec.ts`. These checks render emails
and mock delivery; they do not send diagnostic messages to real inboxes.

The shared notification layout and all six Auth designs were deployed on
2026-10-05. Auth subjects and HTML were read back and matched the generated
templates; SMTP, confirmation gates, and redirects were unchanged. The full
project checks, 12 Deno email tests, and email layouts/preferences at all five
documented widths passed. Browser previews were reviewed on mobile and desktop;
actual inbox rendering has not been checked for this design.

## Events and preferences

Admin approval sends a secure Supabase Auth confirmation link to the account's
current email. Approval never confirms an unconfirmed email automatically,
including pending accounts from older registration versions. Approval and decline
also enqueue identity status notifications, which remain enabled for unconfirmed
accounts. The scheduled worker retries a failed approval confirmation before
finishing that approval's queue event, and checks the current review, account
status, and document expiry. A saved decision remains successful when immediate
email delivery fails. Sent confirmations are not duplicated on ordinary retries.

The confirmation retry and decision-handling correction was deployed to Supabase
on 2026-10-05 with `send-system-emails` version 6 and
`account-admin-identity-review` version 5. The registration migration preserves
inbox confirmation after admin approval, including older unconfirmed accounts.
The live rollback suites passed, and Gmail SMTP, Auth confirmation settings, and
the active minute scheduler were verified. No diagnostic email was sent during
this rollout; inbox delivery is not claimed by these checks.

Run `node scripts/inspect-registration-email.mts` for a read-only diagnostic of
SMTP configuration, queue counts, scheduled jobs, and review delivery states.
It prints no credentials, recipient addresses, or identity evidence. SMTP
acceptance and an empty failure queue do not establish inbox receipt.

The diagnostic also groups recipients by role and reserved test domain without
printing addresses. On 2026-10-06 the hosted queue showed SMTP-accepted identity,
booking, and support notifications to reserved test addresses, including an admin
recipient. These can produce Gmail bounce notices in the sender's inbox; that is
different from routing the applicant's email to the sender. The worker now skips
`.test`, `.invalid`, `.example`, `.localhost`, and the reserved `example.com`,
`example.net`, and `example.org` domains (including subdomains), with a recorded
skip reason. This guard runs before SMTP and approval-confirmation retries.
The guard was deployed on 2026-10-07 (Philippine time) as `send-system-emails`
version 8. The worker is active, and its deployed source contains the reserved
recipient guard. An unauthorized POST returned 401 before accessing the queue;
all Auth settings, including SMTP and the confirmation button template, matched
the pre-deployment configuration. The 19 Deno email tests passed before deployment;
the unchanged application source had already passed `npm run check` and the 34
relevant registration/email Playwright journeys. No diagnostic email was sent.
Already-sent queue rows and existing bounce messages remain historical.

Database triggers enqueue new booking and lifecycle/payment/delivery/dispute/
schedule updates, incoming messages, payment outcomes, refunds, quotes,
rescheduling, public support progress, published reviews, identity/account status,
and boost payment outcomes. New support cases and identities pending review also
notify active administrators. Inserts and relevant changes enqueue transactionally;
timestamp, read receipt and internal metadata changes do not. Existing history is
not backfilled. Supabase Auth sends confirmation, recovery, invitation and
email-change messages through the same SMTP account. Payment-provider receipts
continue to use the provider's own delivery service.

The worker resolves the recipient through Supabase Auth, never a client-supplied
email address. Messages notify only the other conversation participant. Email
payloads exclude message bodies, ID evidence, private admin notes and provider
errors. Optional notifications require a confirmed email and respect saved email
preferences; identity and account alerts remain enabled. Missing preferences
default to enabled. SMS preferences are stored; SMS delivery is not implemented.

The queue is accessible only to the service role. Workers require a random
server-only secret, claim up to five rows with `SKIP LOCKED`, and use five-minute
leases and five retries with exponential delay. Failed delivery remains in the
queue for inspection. Product transactions do not connect to SMTP. SMTP
acceptance is recorded separately from inbox delivery. A worker crash after SMTP
acceptance but before saving can cause a duplicate on retry; Message-ID stays
stable but SMTP does not provide exactly-once delivery.

## Verification

```sh
npm run check
npx deno test --no-config --node-modules-dir=none --no-lock --allow-env --allow-read supabase/functions/_shared/emailNotifications_test.ts supabase/functions/send-system-emails/handler_test.ts supabase/functions/_shared/emailDatabase_test.ts
npx playwright test tests/e2e/email-preferences.e2e.spec.ts tests/e2e/booking-payment-chat.e2e.spec.ts tests/e2e/admin-support-cases.e2e.spec.ts tests/e2e/identity-registration.e2e.spec.ts tests/e2e/admin-identity-review.e2e.spec.ts tests/e2e/gig-boost-payment.e2e.spec.ts
```

Run `tests/integration/email-notifications.sql` through a privileged connection
after activation. It uses transaction rollback and does not send email. Inspect
`email_notification_outbox` for failed rows and SMTP configuration if delivery
fails. Fix the cause before resetting failed rows to pending with attempts zero.

References: [Google SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp),
[Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), and
[function deployment API](https://supabase.com/docs/reference/api/v1-deploy-a-function).
