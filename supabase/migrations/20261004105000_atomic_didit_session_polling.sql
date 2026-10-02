-- Polling must merge current metadata under the same lock used by webhook/finalization.
create or replace function public.refresh_didit_session_status(
  p_session_id text, p_status text, p_decision jsonb, p_checked_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.verification_sessions%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  if p_status not in ('PENDING','PENDING_REVIEW','APPROVED','DECLINED','ABANDONED','EXPIRED') then
    raise exception 'Unsupported status' using errcode='22023'; end if;
  select * into v_session from public.verification_sessions where session_ref=p_session_id for update;
  if not found then raise exception 'Unknown verification session' using errcode='P0002'; end if;
  if v_session.status='SUPERSEDED' or v_session.verification_data ? 'finalized_at' or
    nullif(v_session.verification_data->>'webhook_received_at','')::timestamptz > p_checked_at then
    return jsonb_build_object('status',v_session.status,'ignored',true);
  end if;
  update public.verification_sessions set status=p_status,
    verification_data=verification_data || jsonb_build_object('status',p_status,'decision',p_decision,'last_checked_at',p_checked_at),
    updated_at=now() where session_ref=p_session_id;
  return jsonb_build_object('status',p_status,'ignored',false);
end;
$$;
revoke all on function public.refresh_didit_session_status(text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.refresh_didit_session_status(text,text,jsonb,timestamptz) to service_role;
