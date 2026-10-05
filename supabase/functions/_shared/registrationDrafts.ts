import { deliverAccountConfirmation } from './accountConfirmation.ts';
import { accountClient, AccountError, signupRole, text } from './accountRegistration.ts';
import { asRecord } from './identityDomain.ts';
import { createSessionNonce, hashSessionNonce, verifySessionNonce, recordRegistrationAttempt } from './identityRegistration.ts';
import { encryptRegistrationPassword, decryptRegistrationPassword } from './registrationCredentials.ts';

export type DraftClient = ReturnType<typeof accountClient>;
export async function readDraft(client: DraftClient, id: string) {
  const result = await client.from('registration_drafts').select('*').eq('id', id).maybeSingle();
  if (result.error) throw new AccountError('Registration could not be loaded. Retry.', 503);
  return result.data ? asRecord(result.data) : null;
}
export async function ownedDraft(client: DraftClient, body: Record<string, unknown>) {
  if (!body.userId) return null;
  const draft = await readDraft(client, text(body.userId));
  if (!draft) return null;
  if (!await verifySessionNonce(text(draft.id), body.nonce, draft.nonce_hash))
    throw new AccountError('Your registration could not be validated. Resume in the browser where you started.', 403);
  if (Date.parse(text(draft.expires_at)) < Date.now()) throw new AccountError('This registration expired. Start again.', 410);
  return draft;
}
export function draftState(draft: Record<string, unknown>) {
  const status = text(draft.provider_status);
  return { state: ['DECLINED','ABANDONED','EXPIRED'].includes(status) ? 'declined'
    : status === 'PENDING_REVIEW' ? 'identity_review' : draft.session_id ? 'identity_in_progress' : 'identity_pending',
    email: draft.email, signupRole: draft.account_role, sessionId: draft.session_id, sessionUrl: draft.session_url };
}
export async function createRegistrationDraft(request: Request, client: DraftClient, body: Record<string, unknown>) {
  const role = signupRole(body.signupRole); const email = text(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128 || password !== password.trim() || body.acceptedTerms !== true)
    throw new AccountError('Enter a valid email, a password of at least 8 characters, and accept the Terms and Conditions.');
  await recordRegistrationAttempt(client, request, { action: 'base_account', email });
  const id = crypto.randomUUID(); const nonce = createSessionNonce();
  const saved = await client.from('registration_drafts').insert({ id, email, account_role: role,
    password_ciphertext: await encryptRegistrationPassword(id, password), nonce_hash: await hashSessionNonce(id, nonce) });
  if (saved.error) throw new AccountError('Your registration details could not be saved. Retry.', 503);
  return { state: 'identity_pending', email, signupRole: role, pendingAccount: { userId: id, nonce } };
}
export async function finalizeRegistrationDraft(client: DraftClient, id: string) {
  let draft = await readDraft(client,id);
  if (!draft) throw new AccountError('Registration could not be found.',404);
  if (draft.finalized_at) return deliverAccountConfirmation(client,id);
  if (Date.parse(text(draft.expires_at)) < Date.now()) return { ...draftState(draft), state: 'declined' };
  if (!['APPROVED','PENDING_REVIEW'].includes(text(draft.provider_status))) return draftState(draft);
  const lease = crypto.randomUUID();
  const claimed = await client.rpc('claim_registration_draft',{p_id:id,p_lease:lease,p_operation:'finalize'});
  if (claimed.error) throw new AccountError('Account creation could not start. Retry.',503);
  if (!claimed.data) return draftState(draft);
  try {
    draft = await readDraft(client,id);
    if (!draft) throw new AccountError('Registration could not be found.',404);
    const existing = await client.auth.admin.getUserById(id);
    if (existing.error && existing.error.status!==404) throw new AccountError('Account creation could not be checked. Retry.',503);
    if (!existing.data.user) {
      const role = text(draft.account_role);
      const created = await client.auth.admin.createUser({ id, email:text(draft.email),
        password:await decryptRegistrationPassword(id,text(draft.password_ciphertext)),email_confirm:false,
        user_metadata:{registration_version:3,role,is_worker:role==='worker',is_client:role==='client'},
        app_metadata:{registration_version:3,registration_draft_id:id,signup_role:role,identity_required:true,verification_status:'UNVERIFIED'} });
      if (created.error || !created.data.user) throw new AccountError('The account could not be created. If this email is registered, sign in or use another email.',409);
    } else if (existing.data.user.app_metadata.registration_draft_id !== id) throw new AccountError('This account already exists. Sign in.',409);
    const finalized = await client.rpc('finalize_registration_draft',{p_id:id,p_lease:lease});
    if (finalized.error) throw new AccountError('Your account setup could not be completed. Retry.',503);
  } finally {
    await client.from('registration_drafts').update({creation_lease:null,creation_started_at:null}).eq('id',id).eq('creation_lease',lease);
  }
  return deliverAccountConfirmation(client,id);
}
