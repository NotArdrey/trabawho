import { registrationUser } from "../_shared/pendingRegistrationAccess.ts";
import { corsHeaders, jsonResponse, buildIdentityDocumentFingerprint, recordRegistrationAttempt } from "../_shared/identityRegistration.ts";
import { asRecord } from "../_shared/identityDomain.ts";
import { accountClient, AccountError, registrationState, requireConfirmed, text } from "../_shared/accountRegistration.ts";
import { ownedDraft, finalizeRegistrationDraft } from '../_shared/registrationDrafts.ts';
import { manualDocument, uploadManualEvidence } from '../_shared/manualRegistrationEvidence.ts';
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (request.method !== 'POST') return jsonResponse({error:'Method not allowed'},405);
  const client=accountClient();const paths:string[]=[];
  let draftId:string|null=null;let lease:string|null=null;
  try {
    const body=asRecord(await request.json());
    const draft=await ownedDraft(client,body);
    const document=manualDocument(body);
    const user=draft && !draft.finalized_at ? null : await registrationUser(request,client,body);
    const id=user?.id || text(draft?.id);
    if (user) {
      requireConfirmed(user);
      const state=await registrationState(client,user);
      if (!['identity_pending','declined','identity_in_progress'].includes(state.state)) throw new AccountError('This identity is awaiting review or approved.',409);
    } else {
      if (['APPROVED','PENDING_REVIEW'].includes(text(draft?.provider_status))) throw new AccountError('This identity is awaiting review or approved.',409);
      draftId=id;lease=crypto.randomUUID();
      const claim=await client.rpc('claim_registration_draft',{p_id:id,p_lease:lease,p_operation:'manual'});
      if (claim.error || !claim.data) throw new AccountError('Another registration action is in progress. Retry shortly.',409);
    }
    await recordRegistrationAttempt(client,request,{action:'manual_identity_review',email:user?.email || draft?.email,...(user?{userId:id}:{})});
    const evidence=await uploadManualEvidence(client,id,body,paths);
    const fingerprint:string|null=await buildIdentityDocumentFingerprint({}, {...document,documentNumber:text(body.documentNumber)});
    if (!user) {
      const saved=await client.from('registration_drafts').update({document,fingerprint,evidence,provider_status:'PENDING_REVIEW',
        session_id:null,session_url:null,identity_consent_at:new Date().toISOString(),creation_lease:null,creation_started_at:null})
        .eq('id',id).eq('creation_lease',lease);
      if (saved.error) throw new AccountError('Your submission could not be saved. Retry.',503);
      paths.length=0;
      return jsonResponse(await finalizeRegistrationDraft(client,id));
    }
    const saved=await client.rpc('submit_account_manual_review',{p_user_id:id,p_document:document,p_fingerprint:fingerprint,p_evidence:evidence});
    if (saved.error) throw new AccountError('The review could not be saved. Refresh and retry.',409);
    paths.length=0;
    return jsonResponse(await registrationState(client,user));
  } catch (cause) {
    if (paths.length) await client.storage.from('identity-manual').remove(paths);
    const error=cause instanceof AccountError?cause:new AccountError('Manual review could not be submitted. Retry.',503);
    return jsonResponse({error:error.message},error.status);
  } finally {
    if (draftId && lease) await client.from('registration_drafts').update({creation_lease:null,creation_started_at:null}).eq('id',draftId).eq('creation_lease',lease);
  }
});
