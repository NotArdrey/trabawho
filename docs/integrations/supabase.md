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
