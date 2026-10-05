-- Rollback-only live verification. No emails, provider calls, or stored fixtures.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare
  requested_role text; u uuid; pending_user uuid; lease uuid; session_id text;
  manual_user uuid; manual_lease uuid; review uuid; actor uuid;
  document jsonb:='{"fullName":"Draft Contract Test Person","documentType":"passport","expiry":"2099-01-01","backNotApplicable":true}';
begin
  select user_id into actor from public.profiles where role='admin' and account_status='active' limit 1;
  if actor is null then raise exception 'A test administrator is required'; end if;
  foreach requested_role in array array['client','worker'] loop
    u:=gen_random_uuid();lease:=gen_random_uuid();session_id:='draft-test-'||u::text;
    insert into public.registration_drafts(id,email,account_role,password_ciphertext,nonce_hash,session_id,
      session_url,provider_status,document,fingerprint,payload,creation_lease)
    values(u,u::text||'@draft-test.invalid',requested_role,'encrypted-test-only','test-nonce',session_id,
      'https://verification.didit.me/test','APPROVED',document,'draft-fingerprint-'||u::text,'{"timestamp":100}',lease);
    if exists(select 1 from auth.users where id=u) or exists(select 1 from public.profiles where user_id=u) then
      raise exception 'Draft created an Auth or profile record'; end if;
    begin
      perform public.finalize_registration_draft(u,lease);
      raise exception 'Draft finalized without its owned Auth account';
    exception when insufficient_privilege then null; end;
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u::text||'@draft-test.invalid','',
      jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'signup_role',requested_role,
        'registration_version',3,'registration_draft_id',u::text),
      jsonb_build_object('registration_version',3,'role',requested_role,'is_worker',requested_role='worker','is_client',requested_role='client'),now(),now());
    perform public.finalize_registration_draft(u,lease);
    perform public.finalize_registration_draft(u,lease);
    if not exists(select 1 from public.profiles where user_id=u and role=requested_role and
      verification_status='APPROVED' and not is_verified and full_name=document->>'fullName') then
      raise exception 'Approved draft did not store the legal identity with blocked access'; end if;
    if exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then
      raise exception 'Identity approval confirmed email without the inbox link'; end if;
    if not exists(select 1 from public.registration_drafts where id=u and finalized_at is not null and password_ciphertext is null) then
      raise exception 'Finalized draft retained credentials'; end if;
    if requested_role='worker' then
      begin
        perform public.complete_account_provider_setup(u,'{}');
        raise exception 'Unconfirmed email allowed Worker setup';
      exception when insufficient_privilege then null; end;
    end if;
    update auth.users set email_confirmed_at=now() where id=u;
    if not exists(select 1 from public.profiles where user_id=u and is_verified and verification_status='APPROVED') then
      raise exception 'Inbox confirmation did not activate the approved identity'; end if;
  end loop;

  manual_user:=gen_random_uuid();manual_lease:=gen_random_uuid();
  insert into public.registration_drafts(id,email,account_role,password_ciphertext,nonce_hash,provider_status,document,fingerprint,evidence,creation_lease)
  values(manual_user,manual_user::text||'@draft-test.invalid','worker','encrypted-test-only','manual-nonce','PENDING_REVIEW',document,
    'manual-draft-'||manual_user::text,'{"front":"fixture/front.png","selfie":"fixture/selfie.png"}',manual_lease);
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(manual_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',manual_user::text||'@draft-test.invalid','',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'signup_role','worker','registration_version',3,'registration_draft_id',manual_user::text),
    '{"registration_version":3,"role":"worker","is_worker":true,"is_client":false}',now(),now());
  perform public.finalize_registration_draft(manual_user,manual_lease);
  select id into review from public.manual_identity_reviews where user_id=manual_user;
  if review is null then raise exception 'Manual draft did not create an admin review'; end if;
  begin
    perform public.claim_pending_account_email(manual_user,'manual-nonce');
    raise exception 'Pending manual review allowed confirmation email delivery';
  exception when insufficient_privilege then null; end;
  perform public.decide_account_identity_review(review,actor,'APPROVED',
    'Verified the legal name and document against supplied evidence.',gen_random_uuid(),document->>'fullName');
  if exists(select 1 from auth.users where id=manual_user and email_confirmed_at is not null) or
    exists(select 1 from public.profiles where user_id=manual_user and is_verified) then
    raise exception 'Admin approval bypassed inbox confirmation'; end if;
  perform public.claim_pending_account_email(manual_user,'manual-nonce');
  update auth.users set email_confirmed_at=now() where id=manual_user;
  if not exists(select 1 from public.profiles where user_id=manual_user and is_verified and full_name=document->>'fullName') then
    raise exception 'Confirmed manual account did not activate the reviewed name'; end if;

  pending_user:=gen_random_uuid();
  insert into public.registration_drafts(id,email,account_role,nonce_hash,provider_status)
  values(pending_user,pending_user::text||'@draft-test.invalid','client','pending-nonce','PENDING');
  if public.claim_registration_draft(pending_user,gen_random_uuid(),'finalize') then
    raise exception 'Unapproved identity obtained a finalization lease'; end if;
end; $$;
rollback;
