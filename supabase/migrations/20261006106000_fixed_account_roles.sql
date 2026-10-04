-- A person may register once for each role, using separate Auth accounts.
-- Preserve existing profile roles; never convert an existing Client to a Worker.
alter table public.account_registrations add column account_role text;
update public.account_registrations r set account_role=case when p.role='worker' then 'worker' else 'client' end
from public.profiles p where p.user_id=r.user_id;
update public.account_registrations set account_role='client' where account_role is null;
alter table public.account_registrations alter column account_role set default 'client';
alter table public.account_registrations alter column account_role set not null;
alter table public.account_registrations add constraint account_registration_role_check check(account_role in ('client','worker'));

create or replace function public.initialize_account_registration(p_user_id uuid,p_nonce_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select coalesce(raw_app_meta_data->>'signup_role','client') into v_role from auth.users where id=p_user_id;
  if v_role is null or v_role not in ('client','worker') then raise exception 'Choose Client or Worker' using errcode='22023'; end if;
  perform 1 from public.profiles where user_id=p_user_id for update;
  if exists(select 1 from public.profiles where user_id=p_user_id and
    (verification_status<>'UNVERIFIED' or is_verified or identity_reviewed_at is not null)) then
    raise exception 'Existing reviewed identity records cannot be initialized again' using errcode='23514'; end if;
  insert into public.account_registrations(user_id,pending_nonce_hash,account_role) values(p_user_id,p_nonce_hash,v_role);
  insert into public.profiles(user_id,email,full_name,role,is_client,is_worker,identity_role,
    identity_required,verification_status,is_verified)
  select id,email,'',v_role,v_role='client',v_role='worker',case when v_role='worker' then 'musician' else 'fan' end,
    true,'UNVERIFIED',false from auth.users where id=p_user_id
  on conflict(user_id) do update set full_name='',first_name=null,middle_name=null,last_name=null,
    role=v_role,is_client=v_role='client',is_worker=v_role='worker',identity_role=excluded.identity_role,
    identity_required=true,verification_status='UNVERIFIED',is_verified=false;
end; $$;

create function public.guard_fixed_registration_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.account_role is distinct from old.account_role then
    raise exception 'Register a separate account for the other role' using errcode='42501'; end if;
  return new;
end; $$;
create trigger fixed_registration_role before update on public.account_registrations
for each row execute function public.guard_fixed_registration_role();

create function public.guard_fixed_profile_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  select account_role into v_role from public.account_registrations where user_id=new.user_id;
  if v_role is not null and new.role<>'admin' and new.role is distinct from v_role then
    raise exception 'Register a separate account for the other role' using errcode='42501'; end if;
  if v_role is null and tg_op='UPDATE' and old.role in ('client','worker') and new.role in ('client','worker')
    and new.role is distinct from old.role then
    raise exception 'Register a separate account for the other role' using errcode='42501'; end if;
  if new.role in ('client','worker') then
    new.is_client:=new.role='client'; new.is_worker:=new.role='worker';
    new.identity_role:=case when new.role='worker' then 'musician' else 'fan' end;
  end if;
  return new;
end; $$;
create trigger fixed_profile_role before insert or update on public.profiles
for each row execute function public.guard_fixed_profile_role();

-- Earlier V2 provider setup promoted Client profiles but kept Client identity
-- claims. Align their capabilities and current claims with the preserved role.
update public.profiles set is_client=role='client',is_worker=role='worker',
  identity_role=case when role='worker' then 'musician' else 'fan' end
where role in ('client','worker') and row(is_client,is_worker,identity_role) is distinct from
  row(role='client',role='worker',case when role='worker' then 'musician' else 'fan' end);
update public.identity_document_claims c set role=case when p.role='worker' then 'musician' else 'fan' end,
  app_role=p.role from public.profiles p where p.user_id=c.user_id and p.role in ('client','worker') and
  row(c.role,c.app_role) is distinct from row(case when p.role='worker' then 'musician' else 'fan' end,p.role);
-- Pending decisions must retain the fixed role; completed decisions stay historical.
update public.manual_identity_reviews r set submitted_role=case when p.role='worker' then 'musician' else 'fan' end,
  submitted_app_role=p.role from public.profiles p where p.user_id=r.user_id and p.role in ('client','worker')
  and r.status='PENDING_REVIEW' and row(r.submitted_role,r.submitted_app_role) is distinct from
  row(case when p.role='worker' then 'musician' else 'fan' end,p.role);

-- Multiple historical rows for one user/document/role are already prohibited.
-- An admin decision cannot approve a second account with that document and role.
-- Pre-existing conflicts fail this migration for review, rather than changing users.
create unique index identity_document_one_approved_account_per_role
on public.identity_document_claims(document_fingerprint,role)
where status='APPROVED' and user_id is not null and document_fingerprint is not null;

alter function public.complete_account_provider_setup(uuid,jsonb) rename to complete_provider_setup_before_fixed_roles;
create function public.complete_account_provider_setup(p_user_id uuid,p_setup jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from public.profiles where user_id=p_user_id and role='worker' and account_status='active' for update;
  if not found then raise exception 'Sign in to a Worker account to offer services' using errcode='42501'; end if;
  perform public.complete_provider_setup_before_fixed_roles(p_user_id,p_setup);
end; $$;

alter function public.start_booking_checkout_with_address(uuid,bigint,bigint,integer,text,text,jsonb)
rename to start_checkout_before_fixed_roles;
create function public.start_booking_checkout_with_address(p_booking_id uuid default null,p_service_id bigint default null,
  p_slot_id bigint default null,p_quote_version integer default null,p_payment_plan text default 'downpayment',
  p_operation_id text default null,p_service_address jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where user_id=auth.uid() and role in ('client','admin') and account_status='active' for update;
  if not found then raise exception 'Sign in to a Client account to book services' using errcode='42501'; end if;
  return public.start_checkout_before_fixed_roles(p_booking_id,p_service_id,p_slot_id,p_quote_version,
    p_payment_plan,p_operation_id,p_service_address);
end; $$;

create function public.guard_booking_account_roles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where user_id=new.buyer_id and role in ('client','admin')) then
    raise exception 'Sign in to a Client account to book services' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where user_id=new.seller_id and role='worker') then
    raise exception 'Only Worker accounts may offer services' using errcode='42501'; end if;
  return new;
end; $$;
create trigger booking_account_roles before insert or update of buyer_id,seller_id on public.bookings
for each row execute function public.guard_booking_account_roles();

create function public.guard_conversation_account_roles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.buyer_id is not null and not exists(select 1 from public.profiles where user_id=new.buyer_id and role in ('client','admin')) then
    raise exception 'Sign in to a Client account to request services' using errcode='42501'; end if;
  if new.seller_id is not null and not exists(select 1 from public.profiles where user_id=new.seller_id and role='worker') then
    raise exception 'Only Worker accounts may offer services' using errcode='42501'; end if;
  return new;
end; $$;
create trigger conversation_account_roles before insert or update of buyer_id,seller_id on public.conversations
for each row execute function public.guard_conversation_account_roles();

create function public.guard_provider_account_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  v_user:=case when tg_table_name='services' then (to_jsonb(new)->>'seller_id')::uuid else (to_jsonb(new)->>'user_id')::uuid end;
  if not exists(select 1 from public.profiles where user_id=v_user and role='worker') then
    raise exception 'Sign in to a Worker account to offer services' using errcode='42501'; end if;
  return new;
end; $$;
create trigger worker_account_role before insert or update of user_id on public.worker_profiles
for each row execute function public.guard_provider_account_role();
create trigger seller_account_role before insert or update of user_id on public.sellers
for each row execute function public.guard_provider_account_role();
create trigger service_account_role before insert or update of seller_id on public.services
for each row execute function public.guard_provider_account_role();

revoke all on function public.complete_provider_setup_before_fixed_roles(uuid,jsonb),
  public.start_checkout_before_fixed_roles(uuid,bigint,bigint,integer,text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.complete_account_provider_setup(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_account_provider_setup(uuid,jsonb) to service_role;
revoke all on function public.start_booking_checkout_with_address(uuid,bigint,bigint,integer,text,text,jsonb) from public,anon;
grant execute on function public.start_booking_checkout_with_address(uuid,bigint,bigint,integer,text,text,jsonb) to authenticated;
revoke all on function public.guard_fixed_registration_role(),public.guard_fixed_profile_role(),
  public.guard_booking_account_roles(),public.guard_conversation_account_roles(),public.guard_provider_account_role() from public,anon,authenticated;
