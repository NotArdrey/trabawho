import { accountClient, AccountError, signupRole, text } from './accountRegistration.ts';
import { createSessionNonce, hashSessionNonce, recordRegistrationAttempt } from './identityRegistration.ts';
import { deliverAccountConfirmation } from './accountConfirmation.ts';

export async function createEmailFirstRegistration(request: Request, client: ReturnType<typeof accountClient>, body: Record<string, unknown>) {
  const role = signupRole(body.signupRole);
  const email = text(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128 || password !== password.trim() || body.acceptedTerms !== true)
    throw new AccountError('Enter a valid email, a password of at least 8 characters, and accept the Terms and Conditions.');
  await recordRegistrationAttempt(client, request, { action: 'base_account', email });
  const created = await client.auth.admin.createUser({ email, password, email_confirm: false,
    user_metadata: { registration_version: 4, role, is_worker: role === 'worker', is_client: role === 'client' },
    app_metadata: { registration_version: 4, identity_required: true, verification_status: 'UNVERIFIED', signup_role: role } });
  if (created.error || !created.data.user)
    throw new AccountError('This account could not be created. If the email is already registered, sign in or resend confirmation.');
  const user = created.data.user;
  const nonce = createSessionNonce();
  const initialized = await client.rpc('initialize_account_registration', { p_user_id: user.id, p_nonce_hash: await hashSessionNonce(user.id, nonce) });
  if (initialized.error) {
    await client.auth.admin.deleteUser(user.id);
    throw new AccountError('Account setup could not be saved. Retry.', 503);
  }
  // Preserve recovery when SMTP or delivery bookkeeping fails after account creation.
  const state = await deliverAccountConfirmation(client, user.id).catch(() => ({ state: 'email_pending', emailDelivery: { sent: false } }));
  return { ...state, email, signupRole: role, pendingAccount: { userId: user.id, nonce } };
}
