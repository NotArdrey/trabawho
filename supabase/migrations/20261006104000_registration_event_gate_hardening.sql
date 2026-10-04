-- Preserve completed human decisions across later provider approvals, while
-- holding new evidence/name changes and enforcing expiry at every point of use.
alter function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text)
rename to apply_account_didit_event_before_review_guard;
create function public.apply_didit_identity_event(p_event_key text,p_payload_hash text,p_session_id text,
  p_status text,p_payload jsonb,p_document jsonb,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.verification_sessions%rowtype; v_row public.account_registrations%rowtype;
  v_name text:=nullif(btrim(p_document->>'fullName'),''); v_status text:=p_status; v_result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_session from public.verification_sessions where session_ref=p_session_id for update;
  select * into v_row from public.account_registrations where user_id=v_session.user_id for update;
  if v_row.user_id is null or v_row.current_session_id is distinct from p_session_id or v_session.status='SUPERSEDED' or
    exists(select 1 from public.didit_webhook_events where event_key=p_event_key) or
    coalesce((p_payload->>'created_at')::bigint,(p_payload->>'timestamp')::bigint,0)<
      coalesce((v_session.verification_data->>'didit_event_created_at')::bigint,0) then
    return public.apply_account_didit_event_before_review_guard(p_event_key,p_payload_hash,p_session_id,
      p_status,p_payload,p_document,p_fingerprint); end if;
  if p_status='APPROVED' and nullif(p_document->>'expiry','')::date < current_date then v_status:='EXPIRED'; end if;
  if v_status='APPROVED' and v_session.verification_data->>'admin_decision'='DECLINED' then
    v_result:=public.apply_legacy_didit_identity_event(p_event_key,p_payload_hash,p_session_id,'APPROVED',p_payload,p_document,p_fingerprint);
  elsif v_status='APPROVED' and v_session.verification_data->>'admin_decision'='APPROVED' and
    not exists(select 1 from public.manual_identity_reviews where user_id=v_row.user_id and didit_session_id=p_session_id and status='PENDING_REVIEW') and
    (v_name is null or v_name=v_row.source_legal_name or (v_row.source_legal_name is null and v_name=v_row.reviewed_legal_name)) then
    v_result:=public.apply_legacy_didit_identity_event(p_event_key,p_payload_hash,p_session_id,'APPROVED',p_payload,p_document,p_fingerprint);
  else
    if v_status='APPROVED' and v_row.reviewed_legal_name is not null and v_name is not null and
      v_name is distinct from v_row.source_legal_name then
      update public.account_registrations set name_issue='The provider reported a different source name after review.' where user_id=v_row.user_id;
      v_status:='PENDING_REVIEW';
    end if;
    v_result:=public.apply_account_didit_event_before_review_guard(p_event_key,p_payload_hash,p_session_id,
      v_status,p_payload,p_document,p_fingerprint);
  end if;
  update public.account_registrations set provider_status=p_status,source_legal_name=coalesce(v_name,source_legal_name),
    document_type=coalesce(nullif(p_document->>'documentType',''),document_type),updated_at=now() where user_id=v_row.user_id;
  return v_result;
end; $$;
revoke all on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) to service_role;

create or replace function public.claim_account_identity_session(p_user_id uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_profile public.profiles%rowtype; v_previous text;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select current_session_id into v_previous from public.account_registrations where user_id=p_user_id;
  perform 1 from public.verification_sessions where session_ref=v_previous for update;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  select * into v_profile from public.profiles where user_id=p_user_id for update;
  if v_row.user_id is null or v_profile.account_status<>'active' or not exists(
    select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
    raise exception 'Confirm your email before identity verification' using errcode='42501'; end if;
  if v_row.current_session_id is distinct from v_previous then return false; end if;
  if v_profile.verification_status='PENDING_REVIEW' or
    (v_profile.verification_status='APPROVED' and (v_profile.id_document_expiry is null or v_profile.id_document_expiry>=current_date)) or
    v_row.creation_started_at>now()-interval '2 minutes' or
    (v_row.current_session_id is not null and v_profile.verification_status='PENDING' and v_row.provider_status='PENDING') then return false; end if;
  update public.verification_sessions set status='SUPERSEDED' where session_ref=v_previous;
  update public.account_registrations set creation_lease=p_lease,creation_started_at=now(),identity_consent_at=now()
    where user_id=p_user_id;
  return true;
end; $$;

create or replace function public.guard_provider_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.active and exists(select 1 from public.account_registrations where user_id=new.seller_id) and
    (not exists(select 1 from public.account_registrations where user_id=new.seller_id and provider_setup_completed_at is not null) or
      not exists(select 1 from public.profiles where user_id=new.seller_id and is_verified and verification_status='APPROVED'
        and account_status='active' and (id_document_expiry is null or id_document_expiry>=current_date)) or
      not exists(select 1 from auth.users where id=new.seller_id and email_confirmed_at is not null)) then
    raise exception 'Complete verification and provider setup before publishing a gig' using errcode='42501'; end if;
  return new;
end; $$;

create function public.hold_account_provider_listings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.account_registrations where user_id=new.user_id) and
    (not new.is_verified or new.verification_status<>'APPROVED' or new.account_status<>'active' or new.id_document_expiry<current_date) then
    update public.services set active=false,updated_at=now() where seller_id=new.user_id and active;
  end if;
  return new;
end; $$;
create trigger hold_account_provider_listings after update on public.profiles
for each row execute function public.hold_account_provider_listings();

-- Expiry is checked from the live profile even before an expiry webhook arrives.
create or replace function public.complete_account_provider_setup(p_user_id uuid,p_setup jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_service text:=nullif(btrim(p_setup->>'serviceType'),'');
  v_bio text:=nullif(btrim(p_setup->>'bio'),''); v_price numeric; v_pricing text:=coalesce(p_setup->>'pricingModel','fixed');
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from public.account_registrations where user_id=p_user_id for update;
  select full_name into v_name from public.profiles where user_id=p_user_id and account_status='active' and role<>'admin'
    and (not identity_required or (is_verified and verification_status='APPROVED'
      and (id_document_expiry is null or id_document_expiry>=current_date))) for update;
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

create or replace function public.capture_booking_service_address() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype;
begin
  if exists(select 1 from public.account_registrations where user_id=new.buyer_id) then
    select * into v_profile from public.profiles where user_id=new.buyer_id;
    if not v_profile.is_verified or v_profile.verification_status<>'APPROVED' or v_profile.account_status<>'active' or v_profile.id_document_expiry<current_date or
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

create or replace function public.start_booking_checkout_with_address(
  p_booking_id uuid default null,p_service_id bigint default null,p_slot_id bigint default null,
  p_quote_version integer default null,p_payment_plan text default 'downpayment',p_operation_id text default null,
  p_service_address jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_result jsonb; v_booking uuid;
  v_address jsonb; v_key text;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_profile from public.profiles where user_id=v_user for update;
  if exists(select 1 from public.account_registrations where user_id=v_user) then
    if not v_profile.is_verified or v_profile.verification_status<>'APPROVED' or v_profile.account_status<>'active' or v_profile.id_document_expiry<current_date
      or not exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null) then
      raise exception 'Complete email and identity verification before booking' using errcode='42501'; end if;
  end if;
  if p_service_address is not null then
    if jsonb_typeof(p_service_address)<>'object' then raise exception 'Provide a service address' using errcode='22023'; end if;
    foreach v_key in array array['province','city','barangay','address'] loop
      if jsonb_typeof(p_service_address->v_key)<>'string' or
        char_length(btrim(coalesce(p_service_address->>v_key,''))) not between 1 and 500 then
        raise exception 'Complete the province, city, barangay, and specific service address' using errcode='22023'; end if;
    end loop;
    update public.profiles set province=btrim(p_service_address->>'province'),city=btrim(p_service_address->>'city'),
      barangay=btrim(p_service_address->>'barangay'),address=btrim(p_service_address->>'address'),updated_at=now()
      where user_id=v_user returning * into v_profile;
  end if;
  v_address:=jsonb_build_object('province',v_profile.province,'city',v_profile.city,'barangay',v_profile.barangay,'address',v_profile.address);
  if exists(select 1 from public.account_registrations where user_id=v_user) and
    not exists(select 1 from public.bookings where id=p_booking_id and buyer_id=v_user and metadata ? 'service_address') then
    foreach v_key in array array['province','city','barangay','address'] loop
      if nullif(btrim(v_address->>v_key),'') is null then
        raise exception 'Provide the address where this service will take place' using errcode='22023'; end if;
    end loop;
  end if;
  v_result:=public.start_booking_checkout_before_account_gates(p_booking_id,p_service_id,p_slot_id,
    p_quote_version,p_payment_plan,p_operation_id);
  v_booking:=(v_result->'booking'->>'id')::uuid;
  if p_service_address is not null or exists(select 1 from public.account_registrations where user_id=v_user) then
    perform set_config('app.booking_workflow_rpc','on',true);
    update public.bookings set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('service_address',v_address)
      where id=v_booking and buyer_id=v_user and not (coalesce(metadata,'{}'::jsonb) ? 'service_address');
    select jsonb_set(v_result,'{booking}',to_jsonb(b),true) into v_result from public.bookings b where id=v_booking;
  end if;
  return v_result;
end; $$;

-- A local correction does not change the cached provider decision.
create or replace function public.confirm_account_identity_name(p_user_id uuid,p_requested_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_session public.verification_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  -- The session lock precedes account/profile locks, matching webhook ordering.
  select s.* into v_session from public.verification_sessions s join public.account_registrations r
    on r.current_session_id=s.session_ref where r.user_id=p_user_id for update of s;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) or
    not exists(select 1 from public.profiles where user_id=p_user_id and account_status='active') then
    raise exception 'Account access denied' using errcode='42501'; end if;
  if v_row.name_confirmed_at is not null then return; end if;
  if p_requested_name is not null then
    if char_length(btrim(p_requested_name)) not between 2 and 200 then
      raise exception 'Provide the requested legal name' using errcode='22023'; end if;
    if v_row.provider_status not in ('APPROVED','PENDING_REVIEW') then
      raise exception 'Wait for the verification result' using errcode='23514'; end if;
    update public.account_registrations set requested_legal_name=btrim(p_requested_name),
      name_issue='The applicant requested a legal-name correction.' where user_id=p_user_id;
    insert into public.identity_name_actions(user_id,actor_id,action,source_name,requested_name)
    values(p_user_id,p_user_id,'CORRECTION_REQUESTED',v_row.source_legal_name,btrim(p_requested_name));
    perform public.apply_didit_identity_event('correction:'||gen_random_uuid()::text,'',v_row.current_session_id,
      'PENDING_REVIEW',jsonb_build_object('timestamp',extract(epoch from now())::bigint),
      jsonb_build_object('fullName',v_row.source_legal_name,'documentType',v_row.document_type),null);
    update public.account_registrations set provider_status=v_row.provider_status where user_id=p_user_id;
    return;
  end if;
  if v_row.provider_status <> 'APPROVED' or v_row.source_legal_name is null or v_row.name_issue is not null
    or v_session.status <> 'PENDING' then raise exception 'This identity needs review' using errcode='23514'; end if;
  if exists(select 1 from public.profiles where user_id=p_user_id and id_document_expiry < current_date) then
    raise exception 'An expired identity cannot be approved' using errcode='23514'; end if;
  update public.account_registrations set name_confirmed_at=now(),updated_at=now() where user_id=p_user_id;
  update public.profiles set full_name=v_row.source_legal_name,first_name=null,middle_name=null,last_name=null,
    verification_status='APPROVED',is_verified=true,id_verified_at=now(),updated_at=now() where user_id=p_user_id;
  update public.verification_sessions set status='APPROVED' where session_ref=v_row.current_session_id;
  update public.identity_document_claims set status='APPROVED',updated_at=now()
    where user_id=p_user_id and didit_session_id=v_row.current_session_id;
  insert into public.identity_name_actions(user_id,actor_id,action,source_name)
  values(p_user_id,p_user_id,'CONFIRMED',v_row.source_legal_name);
end; $$;
