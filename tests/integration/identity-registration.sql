-- Run on the linked test project through a privileged SQL connection. All fixtures roll back.
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  u uuid := gen_random_uuid();
  reviewer uuid;
  v_review_id uuid;
  op uuid := gen_random_uuid();
  result jsonb;
  sid text := 'identity-transaction-test-' || gen_random_uuid()::text;
  status text;
  verified boolean;
  before_count bigint;
begin
  select user_id into reviewer from public.profiles where role = 'admin' and account_status = 'active' limit 1;
  if reviewer is null then raise exception 'No test administrator'; end if;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',u::text || '@identity-test.invalid','',
    '{"provider":"email","providers":["email"]}','{"full_name":"Identity Transaction Test","role":"client"}',now(),now());
  if not exists(select 1 from public.profiles where user_id=u and verification_status='UNVERIFIED' and identity_required and not is_verified) then
    raise exception 'New auth identity gate failed';
  end if;
  insert into public.verification_sessions(session_ref,verification_data) values(sid,
    jsonb_build_object('email',u::text || '@identity-test.invalid','app_role','client','session_nonce_hash','test'));
  update public.verification_sessions set status='DECLINED' where session_ref=sid;
  begin
    perform public.save_identity_registration(u,jsonb_build_object('email',u::text || '@identity-test.invalid','role','client','verification_status','APPROVED','province','A','city','B','barangay','C','address','D'),'{}','{}',sid,'{}');
    raise exception 'Terminal session race accepted';
  exception when check_violation then null; end;
  update public.verification_sessions set status='PENDING' where session_ref=sid;
  update public.verification_sessions set verification_data=verification_data ||
    jsonb_build_object('webhook_received_at',now(),'didit_event_created_at',100) where session_ref=sid;
  result := public.refresh_didit_session_status(sid,'APPROVED','{}',now()-interval '1 minute');
  if result->>'ignored' <> 'true' then raise exception 'Polling overwrote a newer webhook'; end if;
  result := public.refresh_didit_session_status(sid,'PENDING','{}',now()+interval '1 second');
  if not exists(select 1 from public.verification_sessions where session_ref=sid and verification_data->>'session_nonce_hash'='test' and verification_data->>'didit_event_created_at'='100') then
    raise exception 'Polling removed nonce or webhook metadata'; end if;
  result := public.save_identity_registration(u,jsonb_build_object('full_name','Identity Transaction Test','email',u::text || '@identity-test.invalid',
    'role','client','identity_role','fan','verification_status','PENDING_REVIEW','province','La Union','city','Balaoan','barangay','Almeida','address','12 Main Street','id_document_expiry','2030-01-01'),
    jsonb_build_object('documentType','ID card','documentTypeKey','id_card','source','DIDIT_PENDING'),
    jsonb_build_object('documentType','ID card','documentTypeKey','id_card','source','DIDIT_PENDING'),sid,'{}');
  v_review_id := (result->>'manualReviewId')::uuid;
  result := public.refresh_didit_session_status(sid,'APPROVED','{}',now());
  if result->>'status' <> 'PENDING_REVIEW' or result->>'ignored' <> 'true' then
    raise exception 'Polling bypassed finalized local review'; end if;
  if v_review_id is null or not exists(select 1 from public.profiles where user_id=u and address='12 Main Street' and verification_status='PENDING_REVIEW' and not is_verified) then
    raise exception 'Registration persistence failed';
  end if;
  begin
    perform public.decide_identity_review(v_review_id,u,'APPROVED','The test identity evidence was reviewed.',op);
    raise exception 'Nonadmin decision unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  result := public.apply_didit_identity_event('identity-test-'||sid,'hash',sid,'APPROVED',
    jsonb_build_object('status','Approved','timestamp',extract(epoch from now())::bigint,'created_at',extract(epoch from now())::bigint),'{}',null);
  if result->>'status' <> 'PENDING_REVIEW' then raise exception 'Didit approval bypassed pending admin review'; end if;
  result := public.apply_didit_identity_event('identity-test-'||sid,'hash',sid,'APPROVED','{}','{}',null);
  if result->>'duplicate' <> 'true' then raise exception 'Webhook replay failed'; end if;
  result := public.decide_identity_review(v_review_id,reviewer,'APPROVED','The test identity evidence was reviewed.',op);
  select verification_status,is_verified into status,verified from public.profiles where user_id=u;
  if status <> 'APPROVED' or verified then raise exception 'Approval bypassed email confirmation'; end if;
  result := public.decide_identity_review(v_review_id,reviewer,'APPROVED','The test identity evidence was reviewed.',op);
  if result->>'replayed' <> 'true' then raise exception 'Decision replay failed'; end if;
  if (select count(*) from public.identity_review_actions where review_id=v_review_id and operation_id=op) <> 1 then
    raise exception 'Duplicate audit records'; end if;
  begin
    perform public.decide_identity_review(v_review_id,reviewer,'DECLINED','Another decision should conflict.',gen_random_uuid());
    raise exception 'Conflicting decision unexpectedly allowed';
  exception when check_violation then null; end;
  if not public.claim_identity_email_delivery(v_review_id,false) or public.claim_identity_email_delivery(v_review_id,false) then
    raise exception 'Concurrent confirmation email lease failed'; end if;
  update public.manual_identity_reviews set email_delivery_status='sent',decision_email_sent_at=now() where id=v_review_id;
  if public.claim_identity_email_delivery(v_review_id,true) then raise exception 'Email resend cooldown bypassed'; end if;
  update public.manual_identity_reviews set decision_email_sent_at=now()-interval '2 minutes' where id=v_review_id;
  if not public.claim_identity_email_delivery(v_review_id,true) then raise exception 'Explicit resend lease failed'; end if;
  begin
    update public.identity_review_actions set reason='A changed audit reason should be rejected.' where operation_id=op;
    raise exception 'Audit history could be changed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.identity_review_actions where operation_id=op;
    raise exception 'Audit history could be removed';
  exception when insufficient_privilege then null; end;
  update auth.users set email_confirmed_at=now() where id=u;
  if not exists(select 1 from public.profiles where user_id=u and is_verified and verification_status='APPROVED') then
    raise exception 'Email confirmation did not open identity access';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u)::text,true);
  begin
    update public.profiles set verification_status='DECLINED' where user_id=u;
    raise exception 'Client could mutate verification';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set role='admin' where user_id=u;
    raise exception 'Client could self-promote';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set full_name='Unreviewed browser name' where user_id=u;
    raise exception 'Client could change an identity-registered name';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  update public.profiles set full_name='Reviewed service correction' where user_id=u;
  if not exists(select 1 from public.profiles where user_id=u and full_name='Reviewed service correction') then
    raise exception 'Service identity name correction was blocked'; end if;
  result := public.apply_didit_identity_event('identity-expired-'||sid,'hash',sid,'EXPIRED',jsonb_build_object('created_at',extract(epoch from now())::bigint + 10),'{}',null);
  if not exists(select 1 from public.profiles where user_id=u and not is_verified and verification_status='EXPIRED') then
    raise exception 'KYC expiry did not block access'; end if;
  if not exists(select 1 from auth.users where id=u and raw_app_meta_data->>'verification_status'='EXPIRED') then
    raise exception 'Trusted identity metadata was not synchronized'; end if;
  result := public.apply_didit_identity_event('identity-stale-'||sid,'hash',sid,'APPROVED',jsonb_build_object('created_at',extract(epoch from now())::bigint),'{}',null);
  if result->>'ignored' <> 'true' then raise exception 'Older event overwrote expiry'; end if;
  before_count := (select count(*) from public.didit_webhook_events where event_key='identity-unknown-test');
  begin
    perform public.apply_didit_identity_event('identity-unknown-test','hash','unknown','APPROVED','{}','{}',null);
    raise exception 'Unknown session accepted';
  exception when no_data_found then null; end;
  if before_count <> (select count(*) from public.didit_webhook_events where event_key='identity-unknown-test') then
    raise exception 'Failed event poisoned retry'; end if;
end;
$$;
select 'identity transaction checks passed' result;

rollback;
