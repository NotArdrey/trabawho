-- Isolated PostgreSQL contract fixture; never apply to an application database.
create schema auth;
create role anon;
create role authenticated;
create role service_role;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.role() returns text language sql as $$ select current_setting('test.role', true) $$;
create function public.is_current_user_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin', true), '') = 'yes' $$;
create table auth.users(id uuid primary key);
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333');
create table public.bookings (
  id uuid primary key, buyer_id uuid, seller_id uuid, status text, payment_status text,
  delivery_status text default 'not_delivered', dispute_status text default 'open',
  schedule_status text default 'confirmed', hold_expires_at timestamptz,
  work_started_at timestamptz, completed_at timestamptz, delivered_at timestamptz, balance_due_at timestamptz, start_ts timestamptz,
  slot_id bigint, warranty_eligible boolean default false, schedule_version integer default 1,
  total_charged_amount numeric(12,2), amount_paid numeric(12,2), balance_due_amount numeric(12,2), metadata jsonb
);
create table public.booking_support_cases (
  id uuid primary key, booking_id uuid references public.bookings(id), status text default 'open', closed_at timestamptz
);
create table public.booking_support_admin_actions (id bigint generated always as identity, case_id uuid, action text,
  target_party text, reason text, created_at timestamptz default now());
create table public.payment_attempts (id uuid primary key, booking_id uuid, status text, payment_id text,
  amount numeric(12,2), environment text default 'test');
create table public.booking_audit_events (id bigint generated always as identity, booking_id uuid, event_type text,
  actor_id uuid, actor_role text, reason text, idempotency_key text, event_data jsonb,
  unique (booking_id, event_type, idempotency_key));
create table public.booking_delivery_evidence (booking_id uuid, schedule_version integer);
grant usage on schema public, auth to authenticated;
grant select on public.bookings to authenticated;
