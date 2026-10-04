import { corsHeaders, jsonResponse } from "../_shared/identityRegistration.ts";
import { asRecord } from "../_shared/identityDomain.ts";
import { accountClient, AccountError, accountUser, requireConfirmed } from "../_shared/accountRegistration.ts";
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const client = accountClient(); const user = await accountUser(request, client); requireConfirmed(user);
    const setup = asRecord(await request.json());
    const result = await client.rpc('complete_account_provider_setup', { p_user_id: user.id, p_setup: setup });
    if (result.error) throw new AccountError('Provider setup could not be saved. Complete your service area, gig details, and verification.', 409);
    return jsonResponse({ saved: true });
  } catch (cause) {
    const error = cause instanceof AccountError ? cause : new AccountError('Provider setup could not be completed. Retry.', 503);
    return jsonResponse({ error: error.message }, error.status);
  }
});
