import { AccountError, text, verifiedDocument } from './accountRegistration.ts';
import { asRecord, resolveDiditDecisionStatus } from './identityDomain.ts';
import { identityReturnUrl } from './identityRedirect.ts';
import { buildIdentityDocumentFingerprint, sanitizeIdentityVerificationData, recordRegistrationAttempt } from './identityRegistration.ts';
import { draftState, finalizeRegistrationDraft, readDraft, type DraftClient } from './registrationDrafts.ts';

export async function applyDraftEvent(client: DraftClient, event: Record<string, unknown>) {
  const applied = await client.rpc('apply_registration_draft_event',event);
  if (applied.error) throw new AccountError('The verification result could not be saved. Retry.',503);
  if (!applied.data) return null;
  await finalizeRegistrationDraft(client,String(applied.data));
  return {received:true};
}
export async function draftDidit(request: Request, client: DraftClient, draft: Record<string, unknown>, body: Record<string, unknown>) {
  const id = text(draft.id);
  if (body.action === 'get_session') {
    if (draft.session_id && !['APPROVED','PENDING_REVIEW'].includes(text(draft.provider_status))) {
      const response = await fetch(`https://verification.didit.me/v3/session/${encodeURIComponent(text(draft.session_id))}/decision/`, {
        headers:{'x-api-key':Deno.env.get('DIDIT_API_KEY') || ''},signal:AbortSignal.timeout(10000) });
      if (!response.ok) throw new AccountError('Didit could not check your result. Retry shortly.',503);
      const payload:unknown = await response.json(); const status = resolveDiditDecisionStatus(payload);
      if (!status) throw new AccountError('Your result is not available yet. Retry shortly.',503);
      const document = verifiedDocument(payload);
      await applyDraftEvent(client,{p_event_key:`draft-poll:${crypto.randomUUID()}`,p_payload_hash:'trusted-poll',p_session_id:draft.session_id,
        p_status:status,p_payload:{...asRecord(sanitizeIdentityVerificationData(payload)),timestamp:Math.floor(Date.now()/1000)},
        p_document:{...document,documentNumber:undefined},p_fingerprint:await buildIdentityDocumentFingerprint(payload)});
    }
    return finalizeRegistrationDraft(client,id);
  }
  if (body.acceptedIdentityTerms !== true) throw new AccountError('Consent to ID and selfie verification before continuing.');
  if (draft.session_id && draft.provider_status==='PENDING') return draftState(draft);
  const apiKey = Deno.env.get('DIDIT_API_KEY') || ''; const workflow = Deno.env.get('DIDIT_WORKFLOW_ID') || '';
  if (!apiKey || !workflow) throw new AccountError('Automatic verification is unavailable. Use manual review or retry later.',503);
  await recordRegistrationAttempt(client,request,{action:'account_didit_session',email:draft.email});
  const lease = crypto.randomUUID();
  const claimed = await client.rpc('claim_registration_draft',{p_id:id,p_lease:lease,p_operation:'session'});
  if (claimed.error) throw new AccountError('Verification could not start. Retry.',503);
  if (!claimed.data) return draftState(await readDraft(client,id) || draft);
  try {
    const callback = new URL(`${Deno.env.get('SUPABASE_URL')}/functions/v1/verification-redirect`);
    const returnUrl = identityReturnUrl(body.redirectTo,Deno.env.get('TRABAWHO_APP_URL') || '',Deno.env.get('IDENTITY_ALLOWED_ORIGINS') || '');
    returnUrl.pathname='/register';returnUrl.hash='';returnUrl.search='';
    returnUrl.searchParams.set('didit_return','1');
    callback.searchParams.set('redirect_to',returnUrl.toString());
    const response = await fetch('https://verification.didit.me/v3/session/',{method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey},signal:AbortSignal.timeout(12000),
      body:JSON.stringify({workflow_id:workflow,vendor_data:`draft:${id}:${lease}`,callback:callback.toString(),callback_method:'both',language:'en',
        contact_details:{email:draft.email,send_notification_emails:false},metadata:{registration_version:3,registration_draft_id:id}})});
    if (!response.ok) throw new AccountError('Didit could not start verification. Retry or use manual review.',503);
    const result = asRecord(await response.json()); const sessionId = text(result.session_id); const url = text(result.url);
    if (!sessionId || !url.startsWith('https://')) throw new AccountError('Didit did not return a usable session.',503);
    const saved = await client.from('registration_drafts').update({session_id:sessionId,session_url:url,provider_status:'PENDING',
      document:{},payload:{},fingerprint:null,event_timestamp:0,identity_consent_at:new Date().toISOString()}).eq('id',id).eq('creation_lease',lease);
    if (saved.error) throw new AccountError('Your session could not be saved. Retry.',503);
    return draftState(await readDraft(client,id) || draft);
  } finally {
    await client.from('registration_drafts').update({creation_lease:null,creation_started_at:null}).eq('id',id).eq('creation_lease',lease);
  }
}
