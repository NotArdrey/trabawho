import { z } from 'zod';
import { supabase } from '@/integrations/supabase';
import { clearPendingAccount, pendingAccount, type PendingAccount } from '@/shared/services/pendingAccountRecovery';
import { signOutUser } from '@/shared/services/authSessionService';
export { clearPendingAccount, pendingAccount, savePendingAccount, type PendingAccount } from '@/shared/services/pendingAccountRecovery';

const stateSchema = z.object({
  state: z.enum(['legacy', 'email_pending', 'identity_pending', 'identity_in_progress', 'name_pending', 'identity_review', 'declined', 'ready']),
  email: z.string().optional(), legalName: z.string().nullable().optional(), documentType: z.string().nullable().optional(),
  requestedName: z.string().nullable().optional(), nameIssue: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(), sessionUrl: z.string().url().nullable().optional(),
  providerStatus: z.string().optional(), providerSetupComplete: z.boolean().optional(),
  pendingAccount: z.object({ userId: z.string(), nonce: z.string() }).optional(),
  emailDelivery: z.object({ sent: z.boolean() }).optional(),
  signupRole: z.enum(['client', 'worker']).optional(),
  signupName: z.string().optional(),
  session: z.object({ access_token: z.string(), refresh_token: z.string() }).optional(),
});
export type AccountRegistration = z.infer<typeof stateSchema>;
export type SignupRole = NonNullable<AccountRegistration['signupRole']>;

export class RegistrationRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'RegistrationRequestError';
  }
}

export async function accountRequest(name: string, body: Record<string, unknown>): Promise<unknown> {
  const result = await supabase.functions.invoke<unknown>(name, { body });
  if (result.error) {
    const error: unknown = result.error;
    if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
      const payload: unknown = await error.context.clone().json().catch(() => null);
      const parsed = z.object({ error: z.string() }).safeParse(payload);
      if (parsed.success) throw new RegistrationRequestError(parsed.data.error, error.context.status);
      if (error.context.status === 401)
        throw new RegistrationRequestError('Sign in to continue your registration.', 401);
    }
    throw new Error('The service could not be reached. Check your connection and retry.');
  }
  const rejected = z.object({ error: z.string() }).safeParse(result.data);
  if (rejected.success) throw new Error(rejected.data.error);
  return result.data;
}
export async function registrationRequest(name: string, body: Record<string, unknown>) {
  return stateSchema.parse(await accountRequest(name, { ...body, redirectTo: `${window.location.origin}/register` }));
}
async function resumePendingRegistration(pending: PendingAccount) {
  const state = await registrationRequest('account-registration', { action: 'state', ...pending });
  if (state.state === 'ready' && state.session) {
    const signedIn = await supabase.auth.setSession(state.session);
    if (signedIn.error) throw new Error('Your account is ready. Sign in to continue.');
    clearPendingAccount();
  }
  return state;
}
export async function resumeRegistration() {
  const session = await supabase.auth.getSession();
  if (session.error) throw new Error('Your session could not be restored. Sign in again.');
  const pending = pendingAccount();
  if (!session.data.session) return pending ? resumePendingRegistration(pending) : null;
  const sameAccount = pending?.userId === session.data.session.user.id;
  if (!sameAccount) clearPendingAccount();
  try {
    const state = await registrationRequest('account-registration', { action: 'state' });
    clearPendingAccount();
    return state;
  } catch (cause) {
    // A rejected cached session must not discard valid recovery for this account.
    if (cause instanceof RegistrationRequestError && cause.status === 401 && pending && sameAccount)
      return resumePendingRegistration(pending);
    throw cause;
  }
}
export async function signInForRegistration(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw new Error(result.error.message);
  clearPendingAccount();
  return registrationRequest('account-registration', { action: 'state' });
}
export async function resendFromSignIn(email: string) {
  await accountRequest('account-registration', { action: 'resend_from_sign_in', email, redirectTo: `${window.location.origin}/register` });
}
export async function routePendingRegistration(pathname: string): Promise<boolean> {
  if (pathname === '/register') return true;
  const state = await resumeRegistration();
  if (state && !['legacy', 'ready'].includes(state.state)) {
    window.location.replace('/register'); return true;
  }
  return false;
}
export async function registrationSignOut() {
  try { await signOutUser(); }
  catch { throw new Error('Sign out could not be completed. Retry.'); }
}
export function subscribeToRegistrationAuth(onSignOut: () => void, onSignIn: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { clearPendingAccount(); onSignOut(); }
    else if (event === 'SIGNED_IN' && session) { clearPendingAccount(); onSignIn(); }
  });
  return () => data.subscription.unsubscribe();
}
export async function encodeIdentityImage(file: File | null) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 7 * 1024 * 1024 || file.size === 0)
    throw new Error('Choose JPEG, PNG, or WebP evidence up to 7 MB for each image.');
  return new Promise<{ base64: string; mimeType: string; fileName: string }>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve({ base64: reader.result, mimeType: file.type, fileName: file.name }) : reject(new Error('The image could not be read.'));
    reader.readAsDataURL(file);
  });
}
