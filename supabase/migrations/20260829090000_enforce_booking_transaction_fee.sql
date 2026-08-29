-- Apply an immutable 5% platform transaction fee to every booking.
-- `total_amount` remains the worker's service price; the new columns hold the fee
-- and the amount charged to the buyer.

alter table public.bookings
  add column if not exists transaction_fee_rate numeric(6,5) not null default 0.05,
  add column if not exists transaction_fee_amount numeric(12,2) not null default 0,
  add column if not exists total_charged_amount numeric(12,2) not null default 0;

create or replace function public.enforce_booking_transaction_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_price numeric(12,2);
begin
  -- A buyer must not be able to name the price of a new marketplace booking.
  -- The seller may subsequently quote a different price during negotiation.
  if tg_op = 'INSERT' and auth.uid() = new.buyer_id then
    select round(coalesce(base_price, 0)::numeric, 2)
      into v_service_price
      from public.services
     where id = new.service_id
       and seller_id = new.seller_id;

    if not found then
      raise exception 'Booking service and seller do not match'
        using errcode = '23514';
    end if;

    new.total_amount := v_service_price;
  elsif tg_op = 'UPDATE'
    and auth.uid() = old.buyer_id
    and new.total_amount is distinct from old.total_amount then
    raise exception 'Only the seller can change the booking service price'
      using errcode = '42501';
  end if;

  if new.total_amount is not null and new.total_amount < 0 then
    raise exception 'Booking service price cannot be negative'
      using errcode = '23514';
  end if;

  new.transaction_fee_rate := 0.05;
  new.transaction_fee_amount := round(coalesce(new.total_amount, 0) * 0.05, 2);
  new.total_charged_amount := round(
    coalesce(new.total_amount, 0) + new.transaction_fee_amount,
    2
  );

  return new;
end;
$$;

drop trigger if exists bookings_enforce_transaction_fee on public.bookings;
create trigger bookings_enforce_transaction_fee
before insert or update of total_amount, transaction_fee_rate,
  transaction_fee_amount, total_charged_amount
on public.bookings
for each row
execute function public.enforce_booking_transaction_fee();

-- Backfill existing rows. The trigger also normalizes the rate to exactly 5%.
update public.bookings
set
  transaction_fee_rate = 0.05,
  transaction_fee_amount = round(coalesce(total_amount, 0) * 0.05, 2),
  total_charged_amount = round(coalesce(total_amount, 0) * 1.05, 2);

alter table public.bookings
  drop constraint if exists bookings_transaction_fee_rate_check,
  drop constraint if exists bookings_transaction_fee_amount_check,
  drop constraint if exists bookings_total_charged_amount_check;

alter table public.bookings
  add constraint bookings_transaction_fee_rate_check
    check (transaction_fee_rate = 0.05),
  add constraint bookings_transaction_fee_amount_check
    check (transaction_fee_amount >= 0),
  add constraint bookings_total_charged_amount_check
    check (total_charged_amount >= 0);

comment on column public.bookings.total_amount is
  'Worker service price before the platform transaction fee.';
comment on column public.bookings.transaction_fee_amount is
  'Platform fee fixed at 5% of total_amount and enforced by the database.';
comment on column public.bookings.total_charged_amount is
  'Buyer total: service price plus the 5% transaction fee.';
