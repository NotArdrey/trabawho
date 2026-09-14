# User Management

`/admin/users` covers clients, service providers, and administrators.

- Search and role filters remain usable by keyboard and at supported responsive widths.
- Role, disable, suspension, and restoration actions pass the selected account ID to the existing service boundary.
- Destructive or access-restricting actions name the account and collect a reason.
- Loading, empty, success, and recoverable-error states keep existing records visible where practical.
- Self-demotion, last-admin protection, and complete role-based policy enforcement require verified server-side rules before release.

## Identity review queue

The same `/admin/users` workspace contains the identity review queue for manual registrations and Didit exceptions only. It is not a Worker-qualification queue.

- Opening a review shows account type, authentication email, service location, and available identity evidence without exposing passwords.
- Manual submissions show Name on ID, ID number, expiry date, private front/back ID images, and the selfie through short-lived signed URLs.
- Didit exceptions show the stored verification result or exception context that is available.
- Approve, reject, and request-resubmission decisions require an administrator note and confirmation.
- Approval marks identity verification approved and starts email confirmation; rejection keeps the account unverified; resubmission keeps access blocked and allows new evidence.
- Queue reads and decisions are authorized again inside the identity Edge Function rather than relying on route visibility.
