-- New bookings use 8%; existing bookings retain their agreed rate and checkout amounts.
alter table public.bookings alter column transaction_fee_rate set default 0.08;
alter table public.bookings drop constraint bookings_transaction_fee_rate_check;
alter table public.bookings add constraint bookings_transaction_fee_rate_check check (transaction_fee_rate in (0.05, 0.08));
CREATE OR REPLACE FUNCTION public.enforce_booking_transaction_fee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if tg_op = 'INSERT' then
    new.transaction_fee_rate := 0.08;
  else
    new.transaction_fee_rate := old.transaction_fee_rate;
  end if;
  new.transaction_fee_amount := round(coalesce(new.total_amount, 0) * new.transaction_fee_rate, 2);
  new.total_charged_amount := round(
    coalesce(new.total_amount, 0) + new.transaction_fee_amount,
    2
  );

  return new;
end;
$function$;
