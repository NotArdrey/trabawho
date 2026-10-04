-- Keep every provider offer versioned, time-limited, and independent of a reservation.
alter table public.booking_quotes add column if not exists expires_at timestamptz;
alter table public.booking_quotes add column if not exists response_note text;
update public.booking_quotes
set expires_at = least(created_at + interval '24 hours', proposed_start_ts)
where expires_at is null;
alter table public.booking_quotes alter column expires_at set not null;
alter table public.booking_quotes alter column expires_at set default (now() + interval '24 hours');
alter table public.booking_quotes drop constraint if exists booking_quotes_status_check;
alter table public.booking_quotes add constraint booking_quotes_status_check check
  (status in ('proposed', 'accepted', 'rejected', 'superseded', 'changes_requested', 'declined', 'expired'));
alter table public.booking_quotes add constraint booking_quotes_response_note_length_check
  check (response_note is null or char_length(response_note) between 1 and 1000);
alter table public.bookings drop constraint if exists bookings_quote_status_check;
alter table public.bookings add constraint bookings_quote_status_check check
  (quote_status in ('not_required', 'awaiting_quote', 'proposed', 'accepted', 'rejected',
    'changes_requested', 'declined', 'expired'));

-- Historical rejections invited a revision; preserve that meaning for open requests.
update public.booking_quotes quote set status = 'changes_requested',
  response_note = nullif(left(trim(quote.rejection_reason), 1000), '')
from public.bookings booking
where quote.booking_id = booking.id and quote.status = 'rejected'
  and booking.status = 'pending' and booking.quote_status = 'rejected';
update public.bookings set quote_status = 'changes_requested'
where status = 'pending' and quote_status = 'rejected';

create or replace function public.guard_booking_quote_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = new.booking_id;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'pending' or v_booking.seller_id <> new.created_by then
    raise exception 'This request cannot receive a quote' using errcode = '23514';
  end if;
  if new.proposed_start_ts <= now() or new.proposed_end_ts <= new.proposed_start_ts then
    raise exception 'Choose a valid future schedule' using errcode = '23514';
  end if;
  if public.provider_time_conflicts(v_booking.seller_id, new.proposed_start_ts,
    new.proposed_end_ts, v_booking.id) then
    raise exception 'This provider already has a booking at that time' using errcode = '23514';
  end if;
  new.expires_at := least(new.created_at + interval '24 hours', new.proposed_start_ts);
  return new;
end;
$$;
drop trigger if exists guard_booking_quote_offer on public.booking_quotes;
create trigger guard_booking_quote_offer before insert on public.booking_quotes
for each row execute function public.guard_booking_quote_offer();
revoke all on function public.guard_booking_quote_offer() from public;

-- The existing checkout RPC marks the chosen quote accepted in its transaction.
-- Guard that transition even when a caller bypasses the browser UI.
create or replace function public.guard_booking_quote_acceptance()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_seller_id uuid;
begin
  if new.status <> 'accepted' then return new; end if;
  if old.status not in ('proposed', 'accepted') then
    raise exception 'This quote is no longer available' using errcode = '23514';
  end if;
  if new.expires_at <= now() or new.proposed_start_ts <= now() then
    raise exception 'This quote has expired. Ask for a new offer' using errcode = '23514';
  end if;
  if exists (select 1 from public.booking_quotes newer
    where newer.booking_id = new.booking_id and newer.version > new.version) then
    raise exception 'A newer quote is available' using errcode = '23514';
  end if;
  select seller_id into v_seller_id from public.bookings where id = new.booking_id;
  if public.provider_time_conflicts(v_seller_id, new.proposed_start_ts,
    new.proposed_end_ts, new.booking_id) then
    raise exception 'This provider already has a booking at that time' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_booking_quote_acceptance on public.booking_quotes;
create trigger guard_booking_quote_acceptance before update of status on public.booking_quotes
for each row execute function public.guard_booking_quote_acceptance();
revoke all on function public.guard_booking_quote_acceptance() from public;

create or replace function public.respond_booking_quote(
  p_booking_id uuid, p_quote_version integer, p_action text,
  p_feedback text, p_operation_id text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_event text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_action is null or p_action not in ('request_changes', 'decline') then
    raise exception 'Choose a valid quote response' using errcode = '22023';
  end if;
  if nullif(trim(p_operation_id), '') is null then
    raise exception 'Operation ID required' using errcode = '22023';
  end if;
  if p_action = 'request_changes' and nullif(trim(p_feedback), '') is null then
    raise exception 'Tell the provider what should change' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_feedback, ''))) > 1000 then
    raise exception 'Feedback must be 1000 characters or fewer' using errcode = '22023';
  end if;
  v_event := case when p_action = 'decline' then 'quote_declined' else 'quote_changes_requested' end;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.buyer_id <> v_actor then
    raise exception 'Only the client can respond to this quote' using errcode = '42501';
  end if;
  if exists (select 1 from public.booking_audit_events where booking_id = p_booking_id
    and event_type = v_event and actor_id = v_actor and idempotency_key = p_operation_id) then
    return v_booking;
  end if;
  if v_booking.status <> 'pending' or v_booking.payment_status in
    ('partially_paid', 'paid', 'refund_pending', 'refunded')
    or v_booking.schedule_status in ('held', 'confirmed', 'reschedule_requested') then
    raise exception 'This booking can no longer receive a quote response' using errcode = '23514';
  end if;
  select * into v_quote from public.booking_quotes where booking_id = p_booking_id
    and version = p_quote_version and status = 'proposed'
    and version = (select max(version) from public.booking_quotes where booking_id = p_booking_id)
  for update;
  if not found then raise exception 'This quote is no longer available' using errcode = '23514'; end if;
  if v_quote.expires_at <= now() or v_quote.proposed_start_ts <= now() then
    raise exception 'This quote has expired. Ask for a new offer' using errcode = '23514';
  end if;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.booking_quotes set
    status = case when p_action = 'decline' then 'declined' else 'changes_requested' end,
    rejected_at = now(), response_note = nullif(trim(p_feedback), ''),
    rejection_reason = nullif(trim(p_feedback), ''), updated_at = now()
  where id = v_quote.id;
  if p_action = 'decline' then
    update public.payment_attempts set status = 'cancelled', updated_at = now()
    where booking_id = p_booking_id and status in ('created', 'awaiting_payment', 'processing');
  end if;
  update public.bookings set
    status = case when p_action = 'decline' then 'cancelled' else status end,
    cancellation_status = case when p_action = 'decline' then 'approved' else cancellation_status end,
    cancellation_reason = case when p_action = 'decline' then 'Client declined provider quote' else cancellation_reason end,
    quote_status = case when p_action = 'decline' then 'declined' else 'changes_requested' end,
    schedule_status = case when p_action = 'decline' then 'released' else 'unscheduled' end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'quote_approved', false, 'quote_rejection_reason', nullif(trim(p_feedback), ''),
      'ui_status', case when p_action = 'decline' then 'Cancelled' else 'Changes Requested' end),
    updated_at = now()
  where id = p_booking_id returning * into v_booking;
  insert into public.booking_audit_events(
    booking_id, event_type, actor_id, actor_role, reason, idempotency_key,
    from_status, to_status, event_data
  ) values (
    p_booking_id, v_event, v_actor, 'buyer', nullif(trim(p_feedback), ''), p_operation_id,
    'pending', v_booking.status, jsonb_build_object('quote_id', v_quote.id, 'quote_version', v_quote.version)
  );
  return v_booking;
end;
$$;
revoke all on function public.respond_booking_quote(uuid, integer, text, text, text) from public;
grant execute on function public.respond_booking_quote(uuid, integer, text, text, text) to authenticated;

-- Older clients used "reject" to ask for a revision. Keep that API compatible
-- without allowing it to bypass the new response state machine.
create or replace function public.reject_booking_quote(
  p_booking_id uuid, p_quote_version integer, p_reason text, p_operation_id text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
begin
  return public.respond_booking_quote(
    p_booking_id, p_quote_version, 'request_changes', p_reason, p_operation_id
  );
end;
$$;
revoke all on function public.reject_booking_quote(uuid, integer, text, text) from public;
grant execute on function public.reject_booking_quote(uuid, integer, text, text) to authenticated;

create or replace function public.expire_booking_quotes(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; v_quote public.booking_quotes%rowtype;
begin
  -- Lock bookings first, matching proposal/response lock order.
  for v_quote in select quote.* from public.booking_quotes quote
    join public.bookings booking on booking.id = quote.booking_id
    where quote.status = 'proposed' and quote.expires_at <= now()
    order by quote.expires_at limit greatest(coalesce(p_limit, 100), 1)
    for update of booking skip locked
  loop
    update public.booking_quotes set status = 'expired', updated_at = now()
    where id = v_quote.id and status = 'proposed' and expires_at <= now();
    if not found then continue; end if;
    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings set quote_status = 'expired', schedule_status = 'unscheduled',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_status', 'Quote Expired'),
      updated_at = now()
    where id = v_quote.booking_id and status = 'pending' and quote_status = 'proposed'
      and not exists (select 1 from public.booking_quotes newer
        where newer.booking_id = v_quote.booking_id and newer.version > v_quote.version);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.expire_booking_quotes(integer) from public;
grant execute on function public.expire_booking_quotes(integer) to service_role;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-booking-quotes', '* * * * *',
      $cron$select public.expire_booking_quotes(100);$cron$);
  end if;
end $$;
