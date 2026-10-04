begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare
  requested_role text; u uuid; duplicate_user uuid; actor uuid; review uuid;
  session_id text; lease uuid; result jsonb;
  fingerprint text:='role-smoke-'||gen_random_uuid()::text;
  evidence jsonb:='{"fullName":"Role Contract Test Person","documentType":"passport","expiry":"2099-01-01"}';
begin
  select user_id into actor from public.profiles where role='admin' and account_status='active' limit 1;
  if actor is null then raise exception 'A test administrator is required'; end if;
  foreach requested_role in array array['client','worker'] loop
    u:=gen_random_uuid(); duplicate_user:=gen_random_uuid();
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      id::text||'@role-smoke.invalid','',now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'signup_role',requested_role),
      '{"registration_version":2}',now(),now() from unnest(array[u,duplicate_user]) id;
    perform public.initialize_account_registration(u,'test');
    perform public.initialize_account_registration(duplicate_user,'test');
    lease:=gen_random_uuid(); session_id:='role-smoke-'||u::text;
    perform public.claim_account_identity_session(u,lease);
    perform public.attach_account_identity_session(u,lease,session_id,'https://verification.didit.me/test');
    result:=public.apply_didit_identity_event(session_id,'test',session_id,'APPROVED','{"timestamp":100}',evidence,fingerprint);
    perform public.confirm_account_identity_name(u);
    if not exists(select 1 from public.profiles where user_id=u and role=requested_role and is_verified
      and is_client=(requested_role='client') and is_worker=(requested_role='worker')) then
      raise exception 'One identity could not approve an account of each role'; end if;
    lease:=gen_random_uuid(); session_id:='role-smoke-'||duplicate_user::text;
    perform public.claim_account_identity_session(duplicate_user,lease);
    perform public.attach_account_identity_session(duplicate_user,lease,session_id,'https://verification.didit.me/test');
    result:=public.apply_didit_identity_event(session_id,'test',session_id,'APPROVED','{"timestamp":100}',evidence,fingerprint);
    if not exists(select 1 from public.profiles where user_id=duplicate_user and verification_status='PENDING_REVIEW' and not is_verified) then
      raise exception 'Same-role duplicate was not restricted'; end if;
    select id into review from public.manual_identity_reviews where user_id=duplicate_user and status='PENDING_REVIEW';
    begin
      perform public.decide_account_identity_review(review,actor,'APPROVED',
        'The synthetic document evidence was reviewed for role duplication.',gen_random_uuid(),'Role Contract Test Person');
      raise exception 'Admin approved a duplicate account of the same role';
    exception when unique_violation then null; end;
    if exists(select 1 from public.profiles where user_id=duplicate_user and is_verified) or
      exists(select 1 from public.account_registrations where user_id=duplicate_user and reviewed_legal_name is not null) then
      raise exception 'Failed duplicate approval did not roll back'; end if;
    begin
      update public.profiles set role=case when requested_role='worker' then 'client' else 'worker' end where user_id=u;
      raise exception 'A fixed account role was switched';
    exception when insufficient_privilege then null; end;
    if requested_role='client' then
      begin
        perform public.complete_account_provider_setup(u,'{}');
        raise exception 'Client account could complete Worker setup';
      exception when insufficient_privilege then null; end;
    else
      perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u)::text,true);
      begin
        result:=public.start_booking_checkout_with_address();
        raise exception 'Worker account could start Client checkout';
      exception when insufficient_privilege then null; end;
      perform set_config('request.jwt.claims','{"role":"service_role"}',true);
    end if;
  end loop;
  if (select count(*) from public.identity_document_claims where document_fingerprint=fingerprint and status='APPROVED')<>2 then
    raise exception 'Exactly one approved account per role was not preserved'; end if;
end; $$;
rollback;
