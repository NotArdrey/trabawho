-- Once an identity application exists, browser profile edits must not change
-- the legal name attached to that application. Identity services use service_role.
create or replace function public.guard_registered_identity_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and old.identity_required and
    row(new.first_name, new.middle_name, new.last_name, new.full_name)
      is distinct from row(old.first_name, old.middle_name, old.last_name, old.full_name) then
    raise exception 'Name changes require identity review' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_registered_identity_name
before update on public.profiles
for each row execute function public.guard_registered_identity_name();
