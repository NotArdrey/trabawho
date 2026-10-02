create or replace function public.protect_demo_transaction_fields()
returns trigger language plpgsql set search_path = public as $$
declare v_controlled boolean := coalesce(current_setting('app.booking_workflow_rpc', true), '') = 'on';
begin
  if tg_op = 'UPDATE' and auth.role() = 'authenticated' and not v_controlled and (
    new.balance_due_at is distinct from old.balance_due_at
    or new.work_started_at is distinct from old.work_started_at
    or new.warranty_eligible is distinct from old.warranty_eligible
  ) then raise exception 'Transaction fields require a workflow action' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and old.work_started_at is not null and (
    new.slot_id is distinct from old.slot_id or new.start_ts is distinct from old.start_ts
  ) then raise exception 'Started work cannot be rescheduled' using errcode = '23514'; end if;
  if tg_op = 'UPDATE' and old.balance_due_at = old.start_ts and new.start_ts is distinct from old.start_ts
    and old.work_started_at is null then new.balance_due_at := new.start_ts; end if;
  if new.balance_due_at is not null then
    if new.status in ('in_progress', 'completed')
      and not (tg_op = 'UPDATE' and old.status = new.status and new.payment_status = 'refund_pending')
      and (new.work_started_at is null or new.payment_status <> 'paid') then
      raise exception 'Verified balance and work start are required' using errcode = '23514'; end if;
    if new.status = 'completed' and (tg_op <> 'UPDATE' or old.status <> 'completed') and not exists (
      select 1 from public.booking_delivery_evidence e where e.booking_id = new.id
        and e.schedule_version = new.schedule_version
    ) then raise exception 'Delivery evidence is required for completion' using errcode = '23514'; end if;
  end if;
  if tg_op = 'UPDATE' and coalesce(new.metadata->>'payment_method', '') = 'paymongo-card'
    and (new.status = 'refunded' and old.status <> 'refunded'
      or new.payment_status = 'refunded' and old.payment_status <> 'refunded')
    and (auth.role() is distinct from 'service_role'
      or coalesce(current_setting('app.verified_booking_refund', true), '') <> 'on') then
    raise exception 'A verified provider refund workflow is required' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Applies to historical bookings too, even if balance_due_at was never set.
-- AFTER validation sees the amounts calculated by all BEFORE triggers.
create function public.guard_funded_booking_work()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.work_started_at is not null and old.work_started_at is null)
    or (new.status in ('in_progress', 'completed') and new.status is distinct from old.status)
    or (new.delivery_status in ('seller_claimed', 'buyer_confirmed')
      and new.delivery_status is distinct from old.delivery_status) then
    if new.payment_status is distinct from 'paid' or coalesce(new.balance_due_amount, 0) > 0
      or new.total_charged_amount is null or new.amount_paid < new.total_charged_amount
      or new.dispute_status = 'open' then
      raise exception 'Full verified payment is required before work or completion' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger bookings_guard_funded_work after update on public.bookings
  for each row execute function public.guard_funded_booking_work();

-- Omitting payment_method metadata must not bypass insert-time payment protection.
create function public.guard_browser_booking_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'authenticated' and (
    new.status is distinct from 'pending'
    or new.payment_status not in ('unpaid', 'pending_provider')
    or new.amount_paid is distinct from 0
    or new.delivery_status is distinct from 'not_delivered'
    or new.work_started_at is not null or new.completed_at is not null
    or new.delivered_at is not null
  ) then raise exception 'New bookings require verified payment and lifecycle actions' using errcode = '42501'; end if;
  return new;
end;
$$;
create trigger bookings_guard_browser_insert after insert on public.bookings
  for each row execute function public.guard_browser_booking_insert();
