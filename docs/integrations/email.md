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

## Events and preferences

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
