-- A refund decision must never reserve a refund against a seeded/manual receipt.
-- The guard runs inside the admin approval transaction, before the booking is
-- marked refund_pending, so an unsupported approval cannot strand the case.
create function public.require_verified_refund_source()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.payment_attempts attempt
    join public.payment_provider_events event on event.payment_attempt_id = attempt.id
    where attempt.id = new.payment_attempt_id
      and attempt.booking_id = new.booking_id
      and attempt.payment_id is not null
      and attempt.status in ('paid', 'late_paid')
      and attempt.amount = new.amount and attempt.currency = new.currency
      and event.event_type = 'checkout_session.payment.paid'
      and event.status = 'processed' and event.processed_at is not null
      and event.livemode = (attempt.environment = 'live')
  ) then
    raise exception 'A verified PayMongo payment is required for refund review'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.require_verified_refund_source() from public;
create trigger booking_refunds_require_verified_source
before insert on public.booking_refunds for each row
execute function public.require_verified_refund_source();

create function public.require_verified_refund_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.refund_requested_at is null and new.refund_requested_at is not null
    and not exists (
      select 1 from public.payment_attempts attempt
      join public.payment_provider_events event on event.payment_attempt_id = attempt.id
      where attempt.booking_id = new.booking_id
        and attempt.status in ('paid', 'late_paid') and attempt.payment_id is not null
        and event.event_type = 'checkout_session.payment.paid'
        and event.status = 'processed' and event.processed_at is not null
        and event.livemode = (attempt.environment = 'live')
    ) then
    raise exception 'A verified PayMongo payment is required for refund review'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.require_verified_refund_request() from public;
create trigger booking_case_require_verified_refund_request
before update of refund_requested_at on public.booking_support_cases for each row
execute function public.require_verified_refund_request();

-- Reveal only eligibility, not provider event details, to the booking client.
create function public.has_verified_refund_payment(p_booking_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_buyer_id uuid;
begin
  select buyer_id into v_buyer_id from public.bookings where id = p_booking_id;
  if auth.uid() is null or auth.uid() is distinct from v_buyer_id then
    raise exception 'Only the booking client can check refund eligibility'
      using errcode = '42501';
  end if;
  return exists (
    select 1 from public.payment_attempts attempt
    join public.payment_provider_events event on event.payment_attempt_id = attempt.id
    where attempt.booking_id = p_booking_id
      and attempt.status in ('paid', 'late_paid') and attempt.payment_id is not null
      and attempt.environment = 'test'
      and event.event_type = 'checkout_session.payment.paid'
      and event.status = 'processed' and event.processed_at is not null
      and event.livemode = false
  );
end;
$$;

revoke all on function public.has_verified_refund_payment(uuid) from public;
grant execute on function public.has_verified_refund_payment(uuid) to authenticated;
