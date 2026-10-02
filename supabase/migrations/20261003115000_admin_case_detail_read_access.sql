-- Allow an active administrator to inspect bookings with a support case.
-- Other bookings remain governed by the existing participant policies.
create function public.admin_can_read_support_booking(p_booking_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_current_user_admin() and exists (
    select 1 from public.booking_support_cases c
    where c.booking_id = p_booking_id
  );
$$;
revoke all on function public.admin_can_read_support_booking(uuid) from public;
grant execute on function public.admin_can_read_support_booking(uuid) to authenticated;

create policy bookings_select_admin_support_case on public.bookings
  for select to authenticated
  using (public.admin_can_read_support_booking(id));

create policy payment_attempts_select_admin_support_case on public.payment_attempts
  for select to authenticated
  using (public.admin_can_read_support_booking(booking_id));

-- Closed or inactive listings must still be identifiable in a case history.
create policy services_select_admin_support_case on public.services
  for select to authenticated
  using (public.is_current_user_admin() and exists (
    select 1 from public.bookings b
    where b.service_id = services.id
      and public.admin_can_read_support_booking(b.id)
  ));
