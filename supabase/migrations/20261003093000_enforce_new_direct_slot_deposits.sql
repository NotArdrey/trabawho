-- Historical full-payment bookings remain valid; new direct-slot bookings
-- cannot be inserted as full-payment bookings or switched to full later.
create function public.enforce_new_direct_slot_deposit()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.metadata->>'booking_mode' = 'with-slots' then
    if tg_op = 'INSERT' then
      if coalesce(new.metadata->>'payment_plan', new.payment_plan) = 'full' then
        raise exception 'New direct-slot bookings require a 50%% deposit' using errcode = '23514';
      end if;
    elsif old.payment_plan is distinct from new.payment_plan and new.payment_plan = 'full' then
      raise exception 'Direct-slot deposit cannot be changed to full payment' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger bookings_enforce_new_direct_slot_deposit
before insert or update on public.bookings
for each row execute function public.enforce_new_direct_slot_deposit();
