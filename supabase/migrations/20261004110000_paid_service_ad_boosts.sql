-- Paid ad campaigns are separate from booking deposits and platform fees.
create table public.service_ad_boost_attempts (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null references public.services(id),
  seller_id uuid not null references public.profiles(user_id),
  duration_days integer not null check (duration_days between 1 and 365),
  amount numeric(12,2) not null check (amount between 1 and 9999999.99),
  currency text not null default 'PHP' check (currency = 'PHP'),
  environment text not null default 'test' check (environment = 'test'),
  status text not null default 'created' check (status in ('created','awaiting_payment','paid','failed','expired','paid_needs_review')),
  operation_id text not null check (length(operation_id) between 1 and 200),
  reference_number text not null unique,
  checkout_session_id text unique,
  checkout_url text,
  payment_id text unique,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  paid_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  unique (seller_id, operation_id)
);
create unique index service_ad_boost_one_pending on public.service_ad_boost_attempts(service_id)
  where status in ('created','awaiting_payment');
create index service_ad_boost_seller_history on public.service_ad_boost_attempts(seller_id, created_at desc);
create table public.service_ad_boost_events (
  event_id text primary key,
  attempt_id uuid not null references public.service_ad_boost_attempts(id),
  payment_id text not null,
  event_type text not null,
  payload_hash text not null,
  received_at timestamptz not null default now()
);
alter table public.service_ad_boost_attempts enable row level security;
alter table public.service_ad_boost_events enable row level security;
create policy boost_owner_read on public.service_ad_boost_attempts for select to authenticated using (seller_id = auth.uid());
create policy boost_event_owner_read on public.service_ad_boost_events for select to authenticated using (
  exists(select 1 from public.service_ad_boost_attempts a where a.id = attempt_id and a.seller_id = auth.uid())
);
revoke all on public.service_ad_boost_attempts, public.service_ad_boost_events from anon, authenticated;
grant select on public.service_ad_boost_attempts, public.service_ad_boost_events to authenticated;
grant all on public.service_ad_boost_attempts, public.service_ad_boost_events to service_role;

-- Retain demo history but stop free campaigns from impersonating paid ads.
update public.services set metadata = jsonb_set(coalesce(metadata, '{}') - 'adBooster', '{ad_booster}',
  coalesce(metadata->'ad_booster', metadata->'adBooster', '{}') || '{"active":false,"legacy_demo":true}'::jsonb)
where metadata ? 'ad_booster' or metadata ? 'adBooster';

create function public.protect_service_ad_boost() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.metadata ? 'ad_booster' or new.metadata ? 'adBooster' then
        raise exception 'Ad boosts require verified payment.' using errcode = '42501';
      end if;
    elsif (new.metadata->'ad_booster') is distinct from (old.metadata->'ad_booster')
       or (new.metadata->'adBooster') is distinct from (old.metadata->'adBooster') then
      raise exception 'Ad boosts require verified payment.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger protect_service_ad_boost before insert or update of metadata on public.services
  for each row execute function public.protect_service_ad_boost();

create function public.start_service_ad_boost_checkout(
  p_service_id bigint, p_duration_days integer, p_amount numeric, p_operation_id text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_service public.services%rowtype;
  v_attempt public.service_ad_boost_attempts%rowtype;
  v_boost jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in before boosting a gig.' using errcode = '42501'; end if;
  if p_duration_days is null or p_duration_days not between 1 and 365
    or p_amount is null or p_amount not between 1 and 9999999.99 or p_amount <> round(p_amount, 2)
    or p_operation_id is null or length(trim(p_operation_id)) not between 1 and 200 then
    raise exception 'Enter whole days (1–365) and a budget of at least PHP 1 with at most two decimal places.' using errcode = '22023';
  end if;
  select * into v_service from public.services where id = p_service_id for update;
  if not found or v_service.seller_id <> auth.uid() or not v_service.active then
    raise exception 'Choose an active gig that you own.' using errcode = '42501';
  end if;
  v_boost := v_service.metadata->'ad_booster';
  if v_boost->>'payment_verified' = 'true' and v_boost->>'active' = 'true'
    and (v_boost->>'ends_at')::timestamptz > now() then
    raise exception 'This gig already has an active paid boost.' using errcode = '23514';
  end if;
  update public.service_ad_boost_attempts set status = 'expired', updated_at = now()
    where service_id = p_service_id and status in ('created','awaiting_payment') and expires_at <= now();
  select * into v_attempt from public.service_ad_boost_attempts
    where seller_id = auth.uid() and operation_id = p_operation_id;
  if found then
    if v_attempt.service_id <> p_service_id or v_attempt.duration_days <> p_duration_days or v_attempt.amount <> p_amount then
      raise exception 'Checkout settings changed. Start a new payment request.' using errcode = '22023';
    end if;
    if v_attempt.status not in ('created','awaiting_payment') or v_attempt.expires_at <= now() then
      raise exception 'This checkout has ended. Start a new payment request.' using errcode = '23514';
    end if;
    return to_jsonb(v_attempt) || jsonb_build_object('service_title', v_service.title);
  end if;
  select * into v_attempt from public.service_ad_boost_attempts
    where service_id = p_service_id and status in ('created','awaiting_payment');
  if found then
    if v_attempt.duration_days <> p_duration_days or v_attempt.amount <> p_amount then
      raise exception 'Finish the existing checkout or wait 15 minutes before changing its settings.' using errcode = '23514';
    end if;
    return to_jsonb(v_attempt) || jsonb_build_object('service_title', v_service.title);
  end if;
  insert into public.service_ad_boost_attempts(service_id, seller_id, duration_days, amount, operation_id, reference_number)
    values (p_service_id, auth.uid(), p_duration_days, p_amount, p_operation_id, 'TW-BOOST-' || gen_random_uuid()) returning * into v_attempt;
  return to_jsonb(v_attempt) || jsonb_build_object('service_title', v_service.title);
end $$;
revoke all on function public.start_service_ad_boost_checkout(bigint, integer, numeric, text) from public;
grant execute on function public.start_service_ad_boost_checkout(bigint, integer, numeric, text) to authenticated;

create function public.record_paymongo_boost_payment(
  p_event_id text, p_event_type text, p_checkout_session_id text, p_payment_id text,
  p_amount numeric, p_currency text, p_livemode boolean, p_payload_hash text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_attempt public.service_ad_boost_attempts%rowtype;
  v_service public.services%rowtype;
  v_event public.service_ad_boost_events%rowtype;
  v_now timestamptz := now();
  v_end timestamptz;
  v_review boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only verified PayMongo events can activate boosts.' using errcode = '42501';
  end if;
  select * into v_attempt from public.service_ad_boost_attempts where checkout_session_id = p_checkout_session_id;
  if not found then raise exception 'Unknown boost checkout.' using errcode = 'P0002'; end if;
  -- Always lock the service before its attempts, matching checkout creation.
  select * into v_service from public.services where id = v_attempt.service_id for update;
  select * into v_attempt from public.service_ad_boost_attempts where id = v_attempt.id for update;
  if p_amount is null or p_amount <> v_attempt.amount or p_currency is distinct from v_attempt.currency
    or p_livemode is distinct from false or coalesce(p_payment_id, '') = ''
    or coalesce(p_event_id, '') = '' or coalesce(p_payload_hash, '') = ''
    or p_event_type not in ('checkout_session.payment.paid', 'checkout_session.api_reconciled') then
    raise exception 'Boost payment does not match its checkout.' using errcode = '22023';
  end if;
  select * into v_event from public.service_ad_boost_events where event_id = p_event_id;
  if found and (v_event.attempt_id <> v_attempt.id or v_event.payload_hash <> p_payload_hash) then
    raise exception 'Conflicting boost payment event.' using errcode = '22023';
  end if;
  if v_attempt.payment_id is not null then
    if v_attempt.payment_id <> p_payment_id then
      raise exception 'A different payment already funded this boost.' using errcode = '23514';
    end if;
    return to_jsonb(v_attempt);
  end if;
  insert into public.service_ad_boost_events(event_id, attempt_id, payment_id, event_type, payload_hash)
    values (p_event_id, v_attempt.id, p_payment_id, p_event_type, p_payload_hash) on conflict (event_id) do nothing;
  v_review := not v_service.active or v_service.seller_id <> v_attempt.seller_id
    or (v_service.metadata->'ad_booster'->>'payment_verified' = 'true'
      and v_service.metadata->'ad_booster'->>'active' = 'true'
      and (v_service.metadata->'ad_booster'->>'ends_at')::timestamptz > v_now);
  v_end := v_now + make_interval(days => v_attempt.duration_days);
  update public.service_ad_boost_attempts set
    status = case when coalesce(v_review, false) then 'paid_needs_review' else 'paid' end,
    payment_id = p_payment_id, paid_at = v_now, updated_at = v_now,
    starts_at = case when coalesce(v_review, false) then null else v_now end,
    ends_at = case when coalesce(v_review, false) then null else v_end end,
    failure_message = case when coalesce(v_review, false) then 'Payment received; this gig needs support review before activation.' else null end
    where id = v_attempt.id returning * into v_attempt;
  if v_attempt.status = 'paid' then
    update public.services set updated_at = v_now, metadata =
      (coalesce(metadata, '{}') - 'adBooster') || jsonb_build_object('ad_booster', jsonb_build_object(
        'active', true, 'payment_verified', true, 'budget_php', v_attempt.amount,
        'duration_days', v_attempt.duration_days, 'starts_at', v_now, 'ends_at', v_end,
        'label', 'Paid gig boost', 'payment', jsonb_build_object('provider', 'paymongo', 'status', 'paid', 'environment', 'test')
      )) where id = v_attempt.service_id;
  end if;
  return to_jsonb(v_attempt);
end $$;
revoke all on function public.record_paymongo_boost_payment(text,text,text,text,numeric,text,boolean,text) from public;
grant execute on function public.record_paymongo_boost_payment(text,text,text,text,numeric,text,boolean,text) to service_role;
