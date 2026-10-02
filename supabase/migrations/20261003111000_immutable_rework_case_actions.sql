-- Keep the case action history immutable even for privileged database callers.
create function public.prevent_booking_case_action_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Booking case actions are append-only' using errcode = '42501';
end;
$$;

create trigger booking_case_actions_immutable
before update or delete on public.booking_case_actions
for each row execute function public.prevent_booking_case_action_mutation();
