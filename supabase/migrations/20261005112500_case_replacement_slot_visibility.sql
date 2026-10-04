-- Accepting a replacement can mark its slot "booked". The existing public slot
-- policy hides booked slots from clients and support, even when they own the case.
-- Allow only the booking participants and admins to read a case-linked slot.
create policy service_slots_select_case_replacement
  on public.service_slots
  for select to authenticated
  using (exists (
    select 1
    from public.booking_case_replacement_visits rv
    join public.bookings b on b.id = rv.booking_id
    where rv.slot_id = service_slots.id
      and (auth.uid() in (b.buyer_id, b.seller_id)
        or public.is_current_user_admin())
  ));

create index booking_case_replacement_slot_lookup
  on public.booking_case_replacement_visits(slot_id);
