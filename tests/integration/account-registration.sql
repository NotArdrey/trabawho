-- Transaction fixtures exercise the actual V2 gates without changing existing accounts.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare
  u uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); u3 uuid:=gen_random_uuid(); u4 uuid:=gen_random_uuid();
  actor uuid; lease uuid:=gen_random_uuid(); sid text:='account-test-'||gen_random_uuid()::text;
  sid2 text:=sid||'-missing'; sid3 text:=sid||'-duplicate'; review uuid; op uuid:=gen_random_uuid(); result jsonb;
  name text:='Maria Isabel de la Cruz Santos';
begin
  select user_id into actor from public.profiles where role='admin' and account_status='active' limit 1;
  if actor is null then raise exception 'A test administrator is required'; end if;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',id::text||'@account-test.invalid','',
    '{"provider":"email","providers":["email"]}','{"registration_version":2}',now(),now() from unnest(array[u,u2,u3,u4]) id;
  perform public.initialize_account_registration(u,'test');
  perform public.initialize_account_registration(u2,'test');
  perform public.initialize_account_registration(u3,'test');
  perform public.initialize_account_registration(u4,'test');
  update auth.users set confirmation_token='old-link-token' where id=u3;
  result:=to_jsonb(public.claim_pending_account_email(u3,'test',u3::text||'-corrected@account-test.invalid'));
  if not exists(select 1 from auth.users where id=u3 and email=u3::text||'-corrected@account-test.invalid' and confirmation_token='') or
    not exists(select 1 from public.profiles where user_id=u3 and email=u3::text||'-corrected@account-test.invalid') then
    raise exception 'Email correction did not atomically revoke the old link and synchronize the profile'; end if;
  begin
    perform public.claim_pending_account_email(u3,'test',null);
    raise exception 'Confirmation request bypassed the cooldown';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.profiles where user_id in (u,u2,u3) and (full_name<>'' or is_worker or is_verified or address is not null)) then
    raise exception 'Base accounts incorrectly collect a name, role, or address'; end if;
  begin
    perform public.claim_account_identity_session(u,lease);
    raise exception 'Unconfirmed email could start Didit';
  exception when insufficient_privilege then null; end;
  update auth.users set email_confirmed_at=now() where id in (u,u2,u3,u4);
  begin
    perform public.claim_pending_account_email(u3,'test','changed-after-confirmation@account-test.invalid');
    raise exception 'A confirmed account allowed a pending email change';
  exception when insufficient_privilege then null; end;
  if not public.claim_account_identity_session(u,lease) or public.claim_account_identity_session(u,gen_random_uuid()) then
    raise exception 'Session creation lease failed'; end if;
  perform public.attach_account_identity_session(u,lease,sid,'https://verification.didit.me/test');
  result:=public.apply_didit_identity_event(sid||'-approved','hash',sid,'APPROVED','{"timestamp":100}',
    jsonb_build_object('fullName',name,'documentType','passport','expiry','2099-01-01'),'test-fingerprint-'||sid);
  if exists(select 1 from public.profiles where user_id=u and is_verified) then raise exception 'Approval bypassed name confirmation'; end if;
  if not exists(select 1 from public.account_registrations where user_id=u and source_legal_name=name and provider_status='APPROVED') then
    raise exception 'Server-derived name was not preserved'; end if;
  begin
    update public.profiles set verification_status='APPROVED',is_verified=true where user_id=u;
    raise exception 'Legacy writes bypassed name gate';
  exception when insufficient_privilege then null; end;
  perform public.confirm_account_identity_name(u);
  perform public.confirm_account_identity_name(u);
  if not exists(select 1 from public.profiles where user_id=u and is_verified and full_name=name and first_name is null) then
    raise exception 'Name confirmation did not open access using the complete source name'; end if;
  if (select count(*) from public.identity_name_actions where user_id=u and action='CONFIRMED')<>1 then
    raise exception 'Confirmation replay duplicated audit'; end if;
  result:=public.apply_didit_identity_event(sid||'-approved','hash',sid,'APPROVED','{}','{}',null);
  if result->>'duplicate'<>'true' then raise exception 'Duplicate webhook was not idempotent'; end if;
  begin
    insert into public.sellers(user_id,display_name) values(u,name);
    insert into public.services(seller_id,title,slug) values(u,'Premature gig','premature');
    raise exception 'A gig published before provider setup';
  exception when insufficient_privilege then null; end;
  perform public.complete_account_provider_setup(u,'{"serviceType":"Plumbing","bio":"Local plumbing repairs","pricingModel":"fixed","fixedPrice":"500","province":"Bulacan","city":"Guiguinto","barangay":"Poblacion"}');
  if not exists(select 1 from public.services where seller_id=u and active) or
    not exists(select 1 from public.account_registrations where user_id=u and provider_setup_completed_at is not null) then
    raise exception 'Provider setup did not publish the gig'; end if;
  if exists(select 1 from public.profiles where user_id=u and address is not null) then raise exception 'Service area became a precise address'; end if;
  lease:=gen_random_uuid(); perform public.claim_account_identity_session(u2,lease);
  perform public.attach_account_identity_session(u2,lease,sid2,'https://verification.didit.me/test');
  result:=public.apply_didit_identity_event(sid2,'hash',sid2,'APPROVED','{"timestamp":100}','{"documentType":"passport"}',null);
  if not exists(select 1 from public.profiles where user_id=u2 and verification_status='PENDING_REVIEW' and not is_verified) then
    raise exception 'Missing name bypassed review'; end if;
  perform public.confirm_account_identity_name(u2,'Requested Unverified Name');
  if exists(select 1 from public.profiles where user_id=u2 and full_name='Requested Unverified Name') then
    raise exception 'Requested name became verified automatically'; end if;
  select id into review from public.manual_identity_reviews where user_id=u2 and status='PENDING_REVIEW';
  begin
    perform public.decide_account_identity_review(review,actor,'APPROVED','The evidence supports a verified name.',op,null);
    raise exception 'Approval accepted a missing reviewed name';
  exception when invalid_parameter_value then null; end;
  result:=public.decide_account_identity_review(review,actor,'APPROVED','The evidence supports a verified name.',op,'Reviewed Legal Name');
  result:=public.decide_account_identity_review(review,actor,'APPROVED','The evidence supports a verified name.',op,'Reviewed Legal Name');
  if not exists(select 1 from public.profiles where user_id=u2 and full_name='Reviewed Legal Name' and is_verified) then
    raise exception 'Reviewed legal name was not applied'; end if;
  result:=public.apply_didit_identity_event(sid2||'-after-review','hash',sid2,'APPROVED',
    jsonb_build_object('timestamp',extract(epoch from now())::bigint+1),'{}',null);
  if not exists(select 1 from public.profiles where user_id=u2 and full_name='Reviewed Legal Name' and is_verified and verification_status='APPROVED') then
    raise exception 'A later provider approval bypassed the completed name review decision'; end if;
  if not exists(select 1 from public.account_registrations where user_id=u2 and requested_legal_name='Requested Unverified Name'
    and reviewed_legal_name='Reviewed Legal Name') then raise exception 'Source and correction were conflated'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u2)::text,true);
  begin
    result:=public.start_booking_checkout_with_address(null,null,null,null,'downpayment','missing-address',null);
    raise exception 'Checkout accepted a missing service address';
  exception when invalid_parameter_value then null; end;
  begin
    result:=public.start_booking_checkout_with_address(null,null,null,null,'downpayment','invalid-address','{"province":"A","city":"B","barangay":"C","address":""}');
    raise exception 'Checkout accepted an incomplete address';
  exception when invalid_parameter_value then null; end;
  begin
    result:=public.start_booking_checkout_with_address(null,null,null,null,'downpayment','rollback-address','{"province":"A","city":"B","barangay":"C","address":"12 Test Street"}');
    raise exception 'Invalid checkout unexpectedly succeeded';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.profiles where user_id=u2 and address is not null) then
    raise exception 'A failed checkout persisted its address outside the transaction'; end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  begin
    result:=public.decide_account_identity_review(review,actor,'APPROVED','The evidence supports a verified name.',op,'Different Name');
    raise exception 'Name decision replay accepted a conflicting name';
  exception when unique_violation then null; end;
  lease:=gen_random_uuid(); perform public.claim_account_identity_session(u3,lease);
  perform public.attach_account_identity_session(u3,lease,sid3,'https://verification.didit.me/test');
  result:=public.apply_didit_identity_event(sid3,'hash',sid3,'APPROVED','{"timestamp":100}',
    jsonb_build_object('fullName',name,'documentType','passport'),'test-fingerprint-'||sid);
  if not exists(select 1 from public.profiles where user_id=u3 and verification_status='PENDING_REVIEW' and not is_verified) then
    raise exception 'Cross-role duplicate bypassed review'; end if;
  result:=public.apply_didit_identity_event(sid3||'-declined','hash',sid3,'DECLINED','{"timestamp":200}','{}',null);
  if not exists(select 1 from public.profiles where user_id=u3 and verification_status='DECLINED' and not is_verified) then
    raise exception 'Decline did not block access'; end if;
  result:=public.apply_didit_identity_event(sid3||'-stale','hash',sid3,'APPROVED','{"timestamp":100}','{}',null);
  if result->>'ignored'<>'true' then raise exception 'Stale event bypassed decline'; end if;
  review:=public.submit_account_manual_review(u3,'{"fullName":"Manual Unverified Name","documentType":"postal_id","expiry":"2099-01-01"}',
    'manual-test-'||sid,'{"front":"test/front.png","back":"test/back.png","selfie":"test/selfie.png"}');
  if not exists(select 1 from public.profiles where user_id=u3 and not is_verified and full_name='') then
    raise exception 'Manual submitted name was automatically verified'; end if;
  result:=public.decide_account_identity_review(review,actor,'DECLINED','The manual evidence failed the review checks.',gen_random_uuid(),null);
  if not exists(select 1 from public.profiles where user_id=u3 and not is_verified and verification_status='DECLINED') then
    raise exception 'Manual rejection opened access'; end if;
  -- A completed admin rejection takes precedence over the provider's approval.
  lease:=gen_random_uuid(); perform public.claim_account_identity_session(u4,lease);
  perform public.attach_account_identity_session(u4,lease,sid||'-rejected','https://verification.didit.me/test');
  result:=public.apply_didit_identity_event(sid||'-rejected','hash',sid||'-rejected','APPROVED','{"timestamp":100}',
    '{"fullName":"Rejected Source Name","documentType":"passport"}',null);
  perform public.confirm_account_identity_name(u4,'Requested Correction');
  select id into review from public.manual_identity_reviews where user_id=u4 and status='PENDING_REVIEW';
  result:=public.decide_account_identity_review(review,actor,'DECLINED','The evidence did not support the requested correction.',gen_random_uuid(),null);
  result:=public.apply_didit_identity_event(sid||'-after-rejection','hash',sid||'-rejected','APPROVED',
    jsonb_build_object('timestamp',extract(epoch from now())::bigint+1),'{}',null);
  if not exists(select 1 from public.profiles where user_id=u4 and verification_status='DECLINED' and not is_verified) then
    raise exception 'Provider approval bypassed the admin rejection'; end if;
  lease:=gen_random_uuid();
  if not public.claim_account_identity_session(u4,lease) then raise exception 'Admin rejection prevented a valid retry'; end if;
  review:=public.submit_account_manual_review(u4,'{"fullName":"Unverified Retry Name","documentType":"passport"}',
    null,'{"front":"test/front.png","back":"test/back.png","selfie":"test/selfie.png"}');
  if not exists(select 1 from public.profiles where user_id=u4 and verification_status='PENDING_REVIEW' and not is_verified)
    or exists(select 1 from public.account_registrations where user_id=u4 and (name_confirmed_at is not null or reviewed_legal_name is not null)) then
    raise exception 'Manual retry retained a stale approval'; end if;
  begin
    perform public.attach_account_identity_session(u4,lease,sid||'-late-create','https://verification.didit.me/test');
    raise exception 'In-flight Didit creation superseded a submitted manual review';
  exception when check_violation then null; end;
  update public.profiles set id_document_expiry='2000-01-01' where user_id=u;
  if exists(select 1 from public.services where seller_id=u and active) then raise exception 'Expired identity kept a provider listing active'; end if;
  begin
    update public.services set active=true where seller_id=u;
    raise exception 'Expired provider could publish a gig';
  exception when insufficient_privilege then null; end;
  begin
    perform public.complete_account_provider_setup(u,'{}');
    raise exception 'Expired identity completed provider setup';
  exception when insufficient_privilege then null; end;
  if not public.claim_account_identity_session(u,gen_random_uuid()) then raise exception 'Expired approved provider could not retry verification'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u)::text,true);
  begin
    result:=public.start_booking_checkout_with_address(null,null,null,null,'downpayment','expired-checkout',null);
    raise exception 'Expired identity started checkout';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  review:=public.submit_account_manual_review(u,'{"fullName":"Requested Retry Name","documentType":"passport"}',
    null,'{"front":"test/front.png","back":"test/back.png","selfie":"test/selfie.png"}');
  if exists(select 1 from public.account_registrations where user_id=u and (name_confirmed_at is not null or reviewed_legal_name is not null))
    or not exists(select 1 from public.profiles where user_id=u and full_name=name and not is_verified) then
    raise exception 'Expired manual retry reused approval or overwrote a protected name'; end if;
  begin
    update public.profiles set verification_status='APPROVED',is_verified=true where user_id=u;
    raise exception 'Manual retry allowed stale name approval';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u)::text,true);
  begin
    update public.profiles set full_name='Browser Edit' where user_id=u;
    raise exception 'Browser changed protected legal name';
  exception when insufficient_privilege then null; end;
end; $$;
select 'account registration transaction checks passed' as result;
rollback;
