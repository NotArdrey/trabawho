-- Administrative notes can contain internal triage details. Participant-facing
-- updates require a separate reviewed communication channel.
drop policy if exists booking_support_admin_actions_read
  on public.booking_support_admin_actions;
create policy booking_support_admin_actions_read
  on public.booking_support_admin_actions for select to authenticated
  using (public.is_current_user_admin());
