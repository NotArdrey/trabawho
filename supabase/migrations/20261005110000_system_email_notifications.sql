-- Transactional outbox: email outages never change successful product actions.
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy notification_preferences_owner on public.notification_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

create table public.email_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('booking','message','payment','refund','quote','reschedule','support','review','identity','account','boost')),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','processing','sent','skipped','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.email_notification_outbox enable row level security;
revoke all on public.email_notification_outbox from anon, authenticated;
grant all on public.email_notification_outbox to service_role;
create index email_outbox_pending on public.email_notification_outbox(available_at, created_at)
  where status in ('pending','processing');

create function public.enqueue_system_email()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  fields text[];
  snapshot jsonb;
  previous jsonb;
  recipient uuid;
  recipients uuid[];
  kind text;
  booking_id uuid;
begin
  case tg_table_name
    when 'bookings' then
      kind := 'booking'; fields := array['status','payment_status','delivery_status','dispute_status','start_ts','end_ts'];
      recipients := array[new.buyer_id, new.seller_id]; booking_id := new.id;
    when 'messages' then
      kind := 'message'; fields := array['id'];
      select array[c.buyer_id,c.seller_id] into recipients from public.conversations c where c.id = new.conversation_id;
    when 'payment_attempts' then
      if n->>'status' not in ('paid','failed','expired','cancelled','refunded','paid_needs_review') then return new; end if;
      kind := 'payment'; fields := array['status']; recipients := array[new.buyer_id]; booking_id := new.booking_id;
    when 'booking_refunds' then
      kind := 'refund'; fields := array['status']; booking_id := new.booking_id;
    when 'booking_quotes' then
      kind := 'quote'; fields := array['status','version','amount','proposed_start_ts','proposed_end_ts']; booking_id := new.booking_id;
    when 'booking_reschedule_requests' then
      kind := 'reschedule'; fields := array['status']; booking_id := new.booking_id;
    when 'booking_support_cases' then
      kind := 'support'; fields := array['status','refund_requested_at','latest_support_action','latest_support_target','latest_support_at']; booking_id := new.booking_id;
    when 'reviews' then
      if not coalesce(new.published, false) then return new; end if;
      kind := 'review'; fields := array['rating','title','body','published']; recipients := array[new.seller_id]; booking_id := new.booking_id;
    when 'profiles' then
      if n->>'account_status' is distinct from o->>'account_status' then
        kind := 'account'; fields := array['account_status'];
      elsif n->>'verification_status' is distinct from o->>'verification_status' then
        kind := 'identity'; fields := array['verification_status'];
      else return new; end if;
      recipients := array[new.user_id];
    when 'service_ad_boost_attempts' then
      if n->>'status' not in ('paid','failed','expired','paid_needs_review') then return new; end if;
      kind := 'boost'; fields := array['status']; recipients := array[new.seller_id];
    else return new;
  end case;
  select jsonb_object_agg(k, n->k), jsonb_object_agg(k, o->k)
    into snapshot, previous from unnest(fields) as k;
  if tg_op = 'UPDATE' and snapshot = previous then return new; end if;
  if recipients is null and booking_id is not null then
    select array[b.buyer_id,b.seller_id] into recipients from public.bookings b where b.id = booking_id;
  end if;
  if (kind = 'support' and tg_op = 'INSERT') or (kind = 'identity' and n->>'verification_status' = 'PENDING_REVIEW') then
    select array_agg(distinct user_id) into recipients from (
      select unnest(recipients) as user_id union all
      select p.user_id from public.profiles p where p.role = 'admin' and p.account_status = 'active'
    ) as audience;
  end if;
  for recipient in select distinct unnest(recipients) loop
    if recipient is null then continue; end if;
    if kind = 'message' and recipient::text = n->>'sender_id' then continue; end if;
    -- Store only public event facts, never messages, documents or admin notes.
    insert into public.email_notification_outbox(event_key, recipient_id, kind, payload)
    values (tg_table_name || ':' || coalesce(n->>'id',n->>'user_id') || ':' || txid_current() || ':' || md5(snapshot::text) || ':' || recipient,
      recipient, kind, jsonb_build_object('reference', coalesce(booking_id::text,n->>'id',n->>'user_id'),
        'status', coalesce(n->>'status',n->>'verification_status'), 'account_status', n->>'account_status',
        'payment_status', n->>'payment_status', 'delivery_status', n->>'delivery_status',
        'dispute_status', n->>'dispute_status', 'start_ts', n->>'start_ts',
        'action', n->>'latest_support_action')) on conflict (event_key) do nothing;
  end loop;
  return new;
end;
$$;
revoke all on function public.enqueue_system_email() from public, anon, authenticated;

do $$
declare name text;
begin
  foreach name in array array['bookings','payment_attempts','booking_refunds','booking_quotes',
    'booking_reschedule_requests','booking_support_cases','service_ad_boost_attempts','reviews'] loop
    execute format('create trigger system_email_event after insert or update on public.%I for each row execute function public.enqueue_system_email()',name);
  end loop;
end;
$$;
create trigger system_email_message after insert on public.messages for each row execute function public.enqueue_system_email();
create trigger system_email_profile after update on public.profiles for each row execute function public.enqueue_system_email();

create function public.claim_email_notifications(p_limit integer default 5)
returns setof public.email_notification_outbox language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.email_notification_outbox set status = 'failed', lease_until = null, lease_token = null,
    last_error = 'Email delivery exhausted its retry limit.'
    where status = 'processing' and lease_until < now() and attempts >= 5;
  return query
  update public.email_notification_outbox q set status = 'processing', attempts = attempts + 1,
    lease_until = now() + interval '5 minutes', lease_token = gen_random_uuid()
  where q.id in (select id from public.email_notification_outbox
    where attempts < 5 and (status = 'pending' and available_at <= now()
      or status = 'processing' and lease_until < now())
    order by created_at for update skip locked limit greatest(1,least(p_limit,5)))
  returning q.*;
end;
$$;
revoke all on function public.claim_email_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_email_notifications(integer) to service_role;

-- Configuration is held in Vault; no bearer credentials enter migration history.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create function public.dispatch_email_notifications()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare endpoint text; worker_secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'system_email_worker_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'system_email_worker_secret';
  if endpoint is null or worker_secret is null then return; end if;
  if not exists(select 1 from public.email_notification_outbox where
    (status = 'pending' and attempts < 5 and available_at <= now() or status = 'processing' and lease_until < now())) then return; end if;
  perform net.http_post(url := endpoint,
    headers := jsonb_build_object('Content-Type','application/json','x-email-worker-secret',worker_secret),
    body := '{}'::jsonb, timeout_milliseconds := 100000);
end;
$$;
revoke all on function public.dispatch_email_notifications() from public, anon, authenticated;
grant execute on function public.dispatch_email_notifications() to service_role;
select cron.schedule('system-email-notifications','* * * * *','select public.dispatch_email_notifications();');
