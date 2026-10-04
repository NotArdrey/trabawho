import { corsHeaders, jsonResponse } from "../_shared/identityRegistration.ts";
import { asRecord } from "../_shared/identityDomain.ts";
import { accountClient, AccountError, accountUser, registrationState, requireConfirmed, text } from "../_shared/accountRegistration.ts";
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const client = accountClient(); const user = await accountUser(request, client); requireConfirmed(user);
    const body = asRecord(await request.json());
    if (body.action !== "confirm_name" && body.action !== "request_correction") throw new AccountError("Choose a supported identity action.");
    if (body.action === "confirm_name" && body.confirmed !== true) throw new AccountError("Confirm the name on your verified ID.");
    const saved = await client.rpc("confirm_account_identity_name", { p_user_id: user.id,
      p_requested_name: body.action === "request_correction" ? text(body.requestedName) : null });
    if (saved.error) throw new AccountError("This identity cannot be confirmed yet. Refresh the result or request review.", 409);
    return jsonResponse(await registrationState(client, user));
  } catch (cause) {
    const error = cause instanceof AccountError ? cause : new AccountError("The identity decision could not be saved. Retry.", 503);
    return jsonResponse({ error: error.message }, error.status);
  }
});
