-- PayMongo hosted-checkout foundation.
-- The browser can request a payment attempt, but only the payment webhook can
-- confirm money received and advance the authoritative booking payment state.

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  buyer_id uuid not null references public.profiles(user_id) on delete restrict,
  provider text not null default 'paymongo',
  environment text not null default 'test',
  purpose text not null,
  status text not null default 'created',
  amount numeric(12,2) not null,
  currency text not null default 'PHP',
  idempotency_key text not null,
  reference_number text not null,
  checkout_session_id text,
  checkout_url text,
  payment_id text,
  failure_code text,
  failure_message text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_provider_check check (provider = 'paymongo'),
  constraint payment_attempts_environment_check check (environment in ('test', 'live')),
  constraint payment_attempts_purpose_check check (purpose in ('initial', 'balance')),
  constraint payment_attempts_status_check check (
    status in ('created', 'awaiting_payment', 'processing', 'paid', 'failed', 'expired', 'cancelled', 'refunded')
  ),
  constraint payment_attempts_amount_check check (amount > 0),
  constraint payment_attempts_currency_check check (currency = 'PHP'),
  constraint payment_attempts_idempotency_unique unique (provider, idempotency_key),
  constraint payment_attempts_reference_unique unique (provider, reference_number),
  constraint payment_attempts_checkout_unique unique (provider, checkout_session_id),
  constraint payment_attempts_payment_unique unique (provider, payment_id)
);

create index if not exists payment_attempts_booking_idx
  on public.payment_attempts(booking_id, created_at desc);
create index if not exists payment_attempts_open_idx
  on public.payment_attempts(status, expires_at)
  where status in ('created', 'awaiting_payment', 'processing');

create table if not exists public.payment_provider_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  resource_id text,
  payment_attempt_id uuid references public.payment_attempts(id) on delete set null,
  livemode boolean not null default false,
  payload_hash text not null,
  status text not null default 'processed',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  primary key (provider, event_id),
  constraint payment_provider_events_provider_check check (provider = 'paymongo'),
  constraint payment_provider_events_status_check check (status in ('processed', 'failed'))
);

alter table public.payment_attempts enable row level security;
alter table public.payment_provider_events enable row level security;

drop policy if exists payment_attempts_select_participants on public.payment_attempts;
create policy payment_attempts_select_participants
  on public.payment_attempts
  for select
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = payment_attempts.booking_id
        and auth.uid() in (b.buyer_id, b.seller_id)
    )
  );

create or replace function public.touch_payment_attempt_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payment_attempts_touch_updated_at on public.payment_attempts;
create trigger payment_attempts_touch_updated_at
before update on public.payment_attempts
for each row execute function public.touch_payment_attempt_updated_at();

create or replace function public.create_booking_payment_attempt(
  p_booking_id uuid,
  p_idempotency_key text,
  p_environment text default 'test'
) returns public.payment_attempts
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_amount numeric(12,2);
  v_purpose text;
  v_attempt_id uuid := gen_random_uuid();
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_environment not in ('test', 'live') then
    raise exception 'Invalid payment environment' using errcode = '22023';
  end if;
  if length(coalesce(p_idempotency_key, '')) < 20
    or length(p_idempotency_key) > 200
    or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then
    raise exception 'Invalid payment idempotency key' using errcode = '22023';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.buyer_id <> v_actor then
    raise exception 'Only the buyer can start payment' using errcode = '42501';
  end if;
  if v_booking.buyer_id = v_booking.seller_id then
    raise exception 'Self-booking is not allowed' using errcode = '23514';
  end if;
  if coalesce(v_booking.metadata->>'payment_method', '') <> 'gcash-advance' then
    raise exception 'This booking is not configured for GCash advance payment' using errcode = '23514';
  end if;
  if v_booking.status not in ('pending', 'confirmed')
    or v_booking.payment_status not in ('pending_provider', 'partially_paid')
    or v_booking.dispute_status = 'open' then
    raise exception 'Booking is not eligible for payment' using errcode = '23514';
  end if;

  v_purpose := case when coalesce(v_booking.amount_paid, 0) > 0 then 'balance' else 'initial' end;
  v_amount := case
    when v_purpose = 'balance' then v_booking.balance_due_amount
    else v_booking.upfront_required_amount
  end;
  if coalesce(v_amount, 0) <= 0 then
    raise exception 'No payment is due for this booking' using errcode = '23514';
  end if;

  select * into v_attempt
  from public.payment_attempts
  where provider = 'paymongo'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_attempt.booking_id <> p_booking_id or v_attempt.amount <> v_amount then
      raise exception 'Idempotency key was already used for another payment' using errcode = '23505';
    end if;
    return v_attempt;
  end if;

  select * into v_attempt
  from public.payment_attempts
  where booking_id = p_booking_id
    and purpose = v_purpose
    and status in ('created', 'awaiting_payment', 'processing')
    and expires_at > now()
  order by created_at desc
  limit 1;
  if found then return v_attempt; end if;

  insert into public.payment_attempts(
    id, booking_id, buyer_id, environment, purpose, amount, currency,
    idempotency_key, reference_number
  ) values (
    v_attempt_id, p_booking_id, v_actor, p_environment, v_purpose, v_amount,
    coalesce(v_booking.currency, 'PHP'), p_idempotency_key,
    'TW-' || upper(substr(replace(v_attempt_id::text, '-', ''), 1, 20))
  ) returning * into v_attempt;

  insert into public.booking_audit_events(
    booking_id, event_type, actor_id, actor_role, idempotency_key,
    from_status, to_status, event_data
  ) values (
    p_booking_id, 'payment_attempt_created', v_actor, 'buyer', p_idempotency_key,
    v_booking.status, v_booking.status,
    jsonb_build_object('attempt_id', v_attempt.id, 'purpose', v_purpose, 'amount', v_amount)
  );

  return v_attempt;
end;
$$;

create or replace function public.record_paymongo_checkout_payment(
  p_event_id text,
  p_event_type text,
  p_checkout_session_id text,
  p_payment_id text,
  p_amount numeric,
  p_currency text,
  p_livemode boolean,
  p_payload_hash text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_booking public.bookings%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the payment server can record PayMongo payments' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_event_id, '')), '') is null
    or nullif(trim(coalesce(p_checkout_session_id, '')), '') is null
    or nullif(trim(coalesce(p_payment_id, '')), '') is null
    or nullif(trim(coalesce(p_payload_hash, '')), '') is null then
    raise exception 'Incomplete PayMongo payment event' using errcode = '22023';
  end if;

  select b.* into v_booking
  from public.payment_provider_events e
  join public.payment_attempts a on a.id = e.payment_attempt_id
  join public.bookings b on b.id = a.booking_id
  where e.provider = 'paymongo' and e.event_id = p_event_id;
  if found then return v_booking; end if;

  select * into v_attempt
  from public.payment_attempts
  where provider = 'paymongo' and checkout_session_id = p_checkout_session_id
  for update;
  if not found then raise exception 'PayMongo checkout session was not found' using errcode = 'P0002'; end if;

  if v_attempt.environment <> case when p_livemode then 'live' else 'test' end then
    raise exception 'PayMongo environment does not match payment attempt' using errcode = '23514';
  end if;
  if upper(coalesce(p_currency, '')) <> v_attempt.currency
    or round(coalesce(p_amount, -1), 2) <> v_attempt.amount then
    raise exception 'PayMongo amount or currency does not match payment attempt' using errcode = '23514';
  end if;
  if v_attempt.status = 'paid' then
    if v_attempt.payment_id <> p_payment_id then
      raise exception 'Payment attempt already belongs to another payment' using errcode = '23505';
    end if;
    select * into v_booking from public.bookings where id = v_attempt.booking_id;
  elsif v_attempt.status not in ('created', 'awaiting_payment', 'processing') then
    raise exception 'Payment attempt is not payable' using errcode = '23514';
  else
    select * into v_booking from public.record_booking_online_payment(
      v_attempt.booking_id,
      p_payment_id,
      v_attempt.amount,
      'paymongo-payment:' || p_payment_id
    );

    update public.payment_attempts
    set status = 'paid', payment_id = p_payment_id, paid_at = now(),
      failure_code = null, failure_message = null
    where id = v_attempt.id;
  end if;

  insert into public.payment_provider_events(
    provider, event_id, event_type, resource_id, payment_attempt_id,
    livemode, payload_hash, status, processed_at
  ) values (
    'paymongo', p_event_id, p_event_type, p_checkout_session_id, v_attempt.id,
    p_livemode, p_payload_hash, 'processed', now()
  ) on conflict (provider, event_id) do nothing;

  return v_booking;
end;
$$;

revoke all on table public.payment_attempts from public;
revoke all on table public.payment_provider_events from public;
grant select on table public.payment_attempts to authenticated;

revoke all on function public.create_booking_payment_attempt(uuid, text, text) from public;
grant execute on function public.create_booking_payment_attempt(uuid, text, text) to authenticated;
revoke all on function public.record_paymongo_checkout_payment(text, text, text, text, numeric, text, boolean, text) from public;
grant execute on function public.record_paymongo_checkout_payment(text, text, text, text, numeric, text, boolean, text) to service_role;

comment on table public.payment_attempts is
  'Server-created payment attempts. Provider webhooks are authoritative for paid state.';
comment on table public.payment_provider_events is
  'Deduplicated PayMongo webhook events processed by trusted server code.';
