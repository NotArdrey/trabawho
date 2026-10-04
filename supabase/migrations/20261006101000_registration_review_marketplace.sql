create function public.submit_account_manual_review(p_user_id uuid,p_document jsonb,p_fingerprint text,p_evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_review uuid; v_email text; v_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  select email into v_email from auth.users where id=p_user_id and email_confirmed_at is not null;
  if v_email is null or v_row.user_id is null or v_row.provider_status in ('APPROVED','PENDING_REVIEW') or
    exists(select 1 from public.profiles where user_id=p_user_id and
      (account_status<>'active' or verification_status in ('APPROVED','PENDING_REVIEW'))) then
    raise exception 'This account cannot submit another review' using errcode='23514'; end if;
  if nullif(btrim(p_document->>'fullName'),'') is null or nullif(p_document->>'documentType','') is null or
    nullif(p_evidence->>'front','') is null or nullif(p_evidence->>'back','') is null or nullif(p_evidence->>'selfie','') is null then
    raise exception 'Complete the identity evidence' using errcode='22023'; end if;
  if p_fingerprint is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fingerprint,0)); end if;
  select count(*) into v_count from public.identity_document_claims where document_fingerprint=p_fingerprint
    and user_id is distinct from p_user_id and status in ('APPROVED','PENDING_REVIEW');
  update public.verification_sessions set status='SUPERSEDED' where session_ref=v_row.current_session_id;
  insert into public.manual_identity_reviews(user_id,submitted_by_email,submitted_role,submitted_app_role,
    document_type,document_type_key,source,front_image_path,back_image_path,selfie_image_path,
    document_fingerprint,duplicate_match_count,duplicate_reason,metadata,verified_full_legal_name)
  values(p_user_id,v_email,'fan','client',p_document->>'documentType',p_document->>'documentType','MANUAL_UPLOAD',
    p_evidence->>'front',p_evidence->>'back',p_evidence->>'selfie',p_fingerprint,v_count,
    case when v_count>0 then 'Another account has a matching identity document.' end,
    jsonb_build_object('registration_version',2,'submitted_name',p_document->>'fullName'),null) returning id into v_review;
  insert into public.identity_document_claims(user_id,original_user_id,role,app_role,document_fingerprint,
    document_type,source,status,manual_review_id,normalized_email)
  values(p_user_id,p_user_id,'fan','client',p_fingerprint,p_document->>'documentType','MANUAL_UPLOAD','PENDING_REVIEW',v_review,lower(v_email));
  update public.account_registrations set current_session_id=null,provider_status='PENDING_REVIEW',
    requested_legal_name=p_document->>'fullName',source_legal_name=null,name_issue='Manual document evidence requires human review.',
    document_type=p_document->>'documentType',identity_consent_at=now(),updated_at=now() where user_id=p_user_id;
  update public.profiles set verification_status='PENDING_REVIEW',is_verified=false,didit_session_id=null,
    id_document_expiry=nullif(p_document->>'expiry','')::date,updated_at=now() where user_id=p_user_id;
  return v_review;
end; $$;

create function public.decide_account_identity_review(p_review_id uuid,p_actor_id uuid,p_decision text,
  p_reason text,p_operation_id uuid,p_reviewed_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_row public.account_registrations%rowtype; v_result jsonb; v_name text:=nullif(btrim(p_reviewed_name),'');
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select user_id into v_user from public.manual_identity_reviews where id=p_review_id for update;
  select * into v_row from public.account_registrations where user_id=v_user for update;
  if v_row.user_id is null then return public.decide_identity_review(p_review_id,p_actor_id,p_decision,p_reason,p_operation_id); end if;
  if p_decision='APPROVED' and (v_name is null or char_length(v_name) not between 2 and 200) then
    raise exception 'Record the legal name verified from the evidence' using errcode='22023'; end if;
  if exists(select 1 from public.identity_name_actions where operation_id=p_operation_id and
    reviewed_name is distinct from v_name) then raise exception 'Conflicting reviewed name' using errcode='23505'; end if;
  if p_decision='APPROVED' then
    update public.account_registrations set reviewed_legal_name=v_name where user_id=v_user;
  end if;
  v_result:=public.decide_identity_review(p_review_id,p_actor_id,p_decision,p_reason,p_operation_id);
  if not coalesce((v_result->>'replayed')::boolean,false) then
    update public.account_registrations set reviewed_legal_name=case when p_decision='APPROVED' then v_name end,
      provider_status=p_decision,updated_at=now() where user_id=v_user;
    if p_decision='APPROVED' then
      update public.profiles set full_name=v_name,first_name=null,middle_name=null,last_name=null where user_id=v_user;
      update public.manual_identity_reviews set verified_full_legal_name=v_name where id=p_review_id;
    end if;
    insert into public.identity_name_actions(user_id,actor_id,operation_id,action,source_name,requested_name,reviewed_name)
    values(v_user,p_actor_id,p_operation_id,'REVIEWED',v_row.source_legal_name,v_row.requested_legal_name,v_name);
  end if;
  return v_result;
end; $$;

-- Defense in depth: neither the legacy finalize RPC nor direct profile writes can bypass V2 name review.
create function public.guard_account_registration_access() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype;
begin
  select * into v_row from public.account_registrations where user_id=new.user_id;
  if v_row.user_id is not null and (new.is_verified or new.verification_status='APPROVED') then
    if (v_row.name_confirmed_at is null and v_row.reviewed_legal_name is null) or
      not exists(select 1 from auth.users where id=new.user_id and email_confirmed_at is not null) then
      raise exception 'Email and identity name confirmation are required' using errcode='42501'; end if;
  end if;
  return new;
end; $$;
create trigger account_registration_access before insert or update on public.profiles
for each row execute function public.guard_account_registration_access();

create function public.complete_account_provider_setup(p_user_id uuid,p_setup jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_service text:=nullif(btrim(p_setup->>'serviceType'),'');
  v_bio text:=nullif(btrim(p_setup->>'bio'),''); v_price numeric; v_pricing text:=coalesce(p_setup->>'pricingModel','fixed');
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from public.account_registrations where user_id=p_user_id for update;
  select full_name into v_name from public.profiles where user_id=p_user_id and account_status='active' and role<>'admin'
    and (not identity_required or (is_verified and verification_status='APPROVED')) for update;
  if v_name is null or not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
    raise exception 'Complete email and identity verification first' using errcode='42501'; end if;
  if v_service is null or v_bio is null or char_length(v_bio)>2000 or v_pricing not in ('fixed','inquiry') or
    nullif(btrim(p_setup->>'province'),'') is null or nullif(btrim(p_setup->>'city'),'') is null or
    nullif(btrim(p_setup->>'barangay'),'') is null then raise exception 'Complete your service area and gig details' using errcode='22023'; end if;
  v_price:=nullif(p_setup->>'fixedPrice','')::numeric;
  if v_pricing='fixed' and coalesce(v_price,0)<=0 then raise exception 'Enter a valid price' using errcode='22023'; end if;
  insert into public.worker_profiles(user_id,service_type,bio,pricing_model,fixed_price,booking_mode,rate_basis,
    payment_advance,payment_after_service,after_service_payment_type,gcash_number,qr_file_name)
  values(p_user_id,v_service,v_bio,v_pricing,v_price,coalesce(p_setup->>'bookingMode','with-slots'),
    coalesce(p_setup->>'rateBasis','per-project'),coalesce((p_setup->>'paymentAdvance')::boolean,false),
    true,coalesce(p_setup->>'afterServicePaymentType','both'),nullif(p_setup->>'gcashNumber',''),nullif(p_setup->>'qrFileName',''))
  on conflict(user_id) do update set service_type=excluded.service_type,bio=excluded.bio,
    pricing_model=excluded.pricing_model,fixed_price=excluded.fixed_price,booking_mode=excluded.booking_mode,
    rate_basis=excluded.rate_basis,payment_advance=excluded.payment_advance,gcash_number=excluded.gcash_number,
    qr_file_name=excluded.qr_file_name,after_service_payment_type=excluded.after_service_payment_type,updated_at=now();
  insert into public.sellers(user_id,display_name,headline,about,tagline,search_meta)
  values(p_user_id,v_name,v_service,v_bio,v_bio,jsonb_build_object('service_type',v_service,'name',v_name,
    'location',jsonb_build_object('province',p_setup->>'province','city',p_setup->>'city','barangay',p_setup->>'barangay')))
  on conflict(user_id) do update set display_name=excluded.display_name,headline=excluded.headline,about=excluded.about,
    tagline=excluded.tagline,search_meta=excluded.search_meta,updated_at=now();
  update public.account_registrations set provider_setup_completed_at=now(),updated_at=now() where user_id=p_user_id;
  update public.profiles set role='worker',is_worker=true,updated_at=now() where user_id=p_user_id;
  if not exists(select 1 from public.services where seller_id=p_user_id) then
    insert into public.services(seller_id,title,slug,description,short_description,price_type,base_price,metadata)
    values(p_user_id,v_service,'initial-'||p_user_id::text,v_bio,v_bio,case when v_pricing='inquiry' then 'custom' else 'fixed' end,
      v_price,jsonb_build_object('pricing_model',v_pricing,'booking_mode',coalesce(p_setup->>'bookingMode','with-slots'),
        'rate_basis',coalesce(p_setup->>'rateBasis','per-project')));
  end if;
end; $$;

create function public.guard_provider_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.active and exists(select 1 from public.account_registrations where user_id=new.seller_id) and
    (not exists(select 1 from public.account_registrations where user_id=new.seller_id and provider_setup_completed_at is not null)
      or not exists(select 1 from public.profiles where user_id=new.seller_id and is_verified and
        verification_status='APPROVED' and account_status='active') or
      not exists(select 1 from auth.users where id=new.seller_id and email_confirmed_at is not null)) then
    raise exception 'Complete verification and provider setup before publishing a gig' using errcode='42501'; end if;
  return new;
end; $$;
create trigger provider_publication before insert or update on public.services
for each row execute function public.guard_provider_publication();

create function public.capture_booking_service_address() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype;
begin
  if exists(select 1 from public.account_registrations where user_id=new.buyer_id) then
    select * into v_profile from public.profiles where user_id=new.buyer_id;
    if not v_profile.is_verified or v_profile.verification_status<>'APPROVED' or v_profile.account_status<>'active' or
      not exists(select 1 from auth.users where id=new.buyer_id and email_confirmed_at is not null) then
      raise exception 'Complete account verification before booking' using errcode='42501'; end if;
    if nullif(btrim(v_profile.province),'') is null or nullif(btrim(v_profile.city),'') is null or
      nullif(btrim(v_profile.barangay),'') is null or nullif(btrim(v_profile.address),'') is null then
      if new.metadata->>'booking_mode'='calendar-only' then return new; end if;
      raise exception 'Provide the address where this service will take place' using errcode='22023'; end if;
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('service_address',
      jsonb_build_object('province',v_profile.province,'city',v_profile.city,'barangay',v_profile.barangay,'address',v_profile.address));
  end if;
  return new;
end; $$;
create trigger booking_service_address before insert on public.bookings
for each row execute function public.capture_booking_service_address();

revoke all on function public.submit_account_manual_review(uuid,jsonb,text,jsonb),
  public.decide_account_identity_review(uuid,uuid,text,text,uuid,text),public.complete_account_provider_setup(uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.submit_account_manual_review(uuid,jsonb,text,jsonb),
  public.decide_account_identity_review(uuid,uuid,text,text,uuid,text),public.complete_account_provider_setup(uuid,jsonb) to service_role;
