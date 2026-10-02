# Supabase

TrabaWho uses Supabase for authentication, application data, storage, RPCs, and Edge Functions.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies and start the application with `npm install` and `npm run dev`.

Only the public/anonymous browser key belongs in frontend environment files. Store service-role keys and model-provider credentials as Supabase secrets, never in source control.

## Database changes

- Treat files under `supabase/migrations/` as the schema history and source of truth.
- Make schema, RPC, RLS, and Edge Function changes through reviewed migrations rather than dashboard-only edits.
- Verify every table exposed to the browser has intentional row-level security policies.
- Do not change production data or deploy migrations as part of ordinary UI work.

## Troubleshooting

When the client cannot connect:

1. Confirm both `VITE_SUPABASE_*` values are present, then restart Vite.
2. Inspect the browser Network panel for the failing Supabase request and status code.
3. Check the project is available and the requested table, RPC, or function exists.
4. Treat `401` and `403` responses as authentication or RLS issues; treat `404` responses as endpoint or schema drift.
5. Reproduce with the smallest relevant application test. Do not paste credentials into diagnostic scripts or documentation.

Run `npm run check` after code changes and the relevant Playwright journey for affected authentication or data workflows.

### Schema contract audit

Run `npm run check:schema` against the project configured by the current environment. It scans application and Edge Function queries, inferred write payloads, the TypeScript table contract, and the current legacy hydration/workflow adapters. Table checks use `GET` with `limit=0`; the audit does not retrieve stored rows, change data, or execute RPCs. RPC names and argument keys are checked against migration history, which does not prove that those RPCs are deployed. Unresolved dynamic queries are reported for manual review.

Missing columns fail the audit. Permission-denied tables remain unverified and produce an incomplete result; verify them with an authenticated account or database access. RLS behavior, storage policies, and successful signed-in writes need separate integration verification. Keep this optional network check outside `npm run check` so ordinary checks do not require live database access.

Provider payment preferences (`payment_advance`, `payment_after_service`, `after_service_payment_type`, and `gcash_number`) belong to `worker_profiles`, as defined by the work schema alignment migration. `sellers` holds the public provider profile. My Work reads preferences through the normalized worker profile and writes them to `worker_profiles`; it must not restore defaults from nonexistent seller columns. Service and preference updates are separate requests, so report a partial save when only the second request fails.

Messages use `body` and `attachments`. Do not retry a failed message write with the retired `content`, `message_type`, or `attachment_url` columns; preserve the draft and surface safe retry feedback.

## Booking activity and reviews

Booking views subscribe to bookings, conversations, messages, reviews, quotes, reschedule requests, payment attempts, support cases, services, and slots. Realtime events require those tables to be in the project publication and readable under RLS. A visible-page reconciliation every 15 seconds and refresh on focus, reconnect, and subscription recovery keep booking/dashboard state current if events are unavailable. Each subscription uses a unique channel name to avoid remount/retry collisions. Frontend configuration does not enable database publications.

Review writes fetch the booking again, require the current user to be its buyer and the stored status to be completed, and use its stored seller ID. Existing reviews are updated on retry. Photo validation precedes upload; failed saves preserve the UI draft and attempt to remove only the photo uploaded for that attempt.

## Assistant image analysis

The `trabawho-chatbot` Edge Function uses `GROQ_API_KEY` from Supabase secrets. Its default image model is `qwen/qwen3.8-27b`, which supports image input and JSON mode. Optional `GROQ_VISION_MODEL` and `GROQ_VISION_FALLBACK_MODELS` overrides must support the same request format; retired Llama vision and Qwen 3.6 overrides are replaced with the current default. See [Groq vision documentation](https://console.groq.com/docs/vision) and [model retirements](https://console.groq.com/docs/deprecations).

After changing the function or its local `vision.ts` dependency, redeploy `trabawho-chatbot` to apply the server change. Local frontend tests mock the function and do not verify the deployed provider or its credentials. Test a repair photo, an unrelated logo, and a subsequent text-only message against the deployed function.
