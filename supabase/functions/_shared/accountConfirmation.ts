import { accountClient, AccountError, registrationState, text } from './accountRegistration.ts';
import { asRecord } from './identityDomain.ts';
import { sendEmailConfirmation } from './identityRegistration.ts';

export async function deliverAccountConfirmation(client: ReturnType<typeof accountClient>, userId: string) {
  const user = await client.auth.admin.getUserById(userId);
  if (user.error || !user.data.user) throw new AccountError('Your account could not be loaded. Retry.', 503);
  const state = await registrationState(client, user.data.user);
  if (state.state !== 'email_pending') return state;
  const row = await client.from('account_registrations').select('pending_nonce_hash,email_sent_at,confirmation_delivery_status').eq('user_id',userId).single();
  if (row.error) throw new AccountError('Email delivery could not be checked. Retry.', 503);
  if (asRecord(row.data).confirmation_delivery_status==='sent') return state;
  if (Date.parse(text(asRecord(row.data).email_sent_at)) > Date.now()-60000) return state;
  const claim = await client.rpc('claim_pending_account_email', { p_user_id:userId,p_expected_hash:asRecord(row.data).pending_nonce_hash });
  if (claim.error) return state;
  const origin = new URL(Deno.env.get('TRABAWHO_APP_URL') || '').origin;
  const delivery = await sendEmailConfirmation(user.data.user.email || '', `${origin}/register`);
  const saved = await client.from('account_registrations').update({confirmation_delivery_status:delivery.sent?'sent':'failed'}).eq('user_id',userId);
  if (saved.error) throw new AccountError('Your account is saved. Email delivery could not be recorded. Use Sign in to request confirmation.',503);
  return { ...state, emailDelivery: delivery };
}
