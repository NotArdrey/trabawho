-- Changing an unconfirmed address and revoking its old link must be atomic with
-- checking confirmation. An HTTP read followed by an admin update has a race.
create function public.claim_pending_account_email(p_user_id uuid,p_expected_hash text,p_new_email text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user auth.users%rowtype; v_row public.account_registrations%rowtype; v_email text;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_user from auth.users where id=p_user_id for update;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  if v_user.id is null or v_user.email_confirmed_at is not null or v_row.user_id is null or
    v_row.pending_nonce_hash is distinct from p_expected_hash or v_row.pending_expires_at < now() or
    not exists(select 1 from public.profiles where user_id=p_user_id and account_status='active') then
    raise exception 'Pending registration is no longer available' using errcode='42501'; end if;
  if v_row.email_sent_at > now()-interval '1 minute' then
    raise exception 'Wait one minute before another confirmation request' using errcode='22023'; end if;
  v_email:=coalesce(lower(btrim(p_new_email)),v_user.email);
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Provide a valid email address' using errcode='22023'; end if;
  if v_email is distinct from v_user.email then
    update auth.users set email=v_email,confirmation_token='',confirmation_sent_at=null,
      email_change='',email_change_token_new='',email_change_token_current='',updated_at=now()
      where id=p_user_id;
    update auth.identities set identity_data=identity_data||jsonb_build_object('email',v_email),updated_at=now()
      where user_id=p_user_id and provider='email';
    update public.profiles set email=v_email,updated_at=now() where user_id=p_user_id;
  end if;
  update public.account_registrations set email_sent_at=now(),updated_at=now() where user_id=p_user_id;
  return v_email;
end; $$;
revoke all on function public.claim_pending_account_email(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_pending_account_email(uuid,text,text) to service_role;

create or replace function public.initialize_account_registration(p_user_id uuid,p_nonce_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from public.profiles where user_id=p_user_id for update;
  if exists(select 1 from public.profiles where user_id=p_user_id and
    (verification_status<>'UNVERIFIED' or is_verified or identity_reviewed_at is not null)) then
    raise exception 'Existing reviewed identity records cannot be initialized again' using errcode='23514'; end if;
  insert into public.account_registrations(user_id,pending_nonce_hash) values(p_user_id,p_nonce_hash);
  insert into public.profiles(user_id,email,full_name,role,is_client,is_worker,identity_role,
    identity_required,verification_status,is_verified)
  select id,email,'','client',true,false,'fan',true,'UNVERIFIED',false from auth.users where id=p_user_id
  on conflict(user_id) do update set full_name='',first_name=null,middle_name=null,last_name=null,
    role='client',is_client=true,is_worker=false,identity_role='fan',identity_required=true,
    verification_status='UNVERIFIED',is_verified=false;
end; $$;
