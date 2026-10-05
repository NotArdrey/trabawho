import { registrationUser } from "../_shared/pendingRegistrationAccess.ts";
import { corsHeaders, jsonResponse, recordRegistrationAttempt } from "../_shared/identityRegistration.ts";
import { asRecord } from "../_shared/identityDomain.ts";
import { identityReturnUrl } from "../_shared/identityRedirect.ts";
import { accountClient, AccountError, registrationRow, registrationState, pollAccountIdentity, text } from "../_shared/accountRegistration.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  let lease: string | null = null; let userId: string | null = null;
  const client = accountClient();
  try {
    const body = asRecord(await request.json());
    const user = await registrationUser(request, client, body); userId = user.id;
    const row = await registrationRow(client, user.id);
    if (!row) throw new AccountError("Contact support to resume an existing identity registration.", 409);
    if (body.action === "get_session") return jsonResponse(await pollAccountIdentity(client, user));
    if (body.acceptedIdentityTerms !== true) throw new AccountError("Consent to the ID and selfie verification before continuing.");
    const state = await registrationState(client, user);
    if (state.state === "identity_in_progress" && row.provider_status === "PENDING") return jsonResponse(state);
    const apiKey = Deno.env.get("DIDIT_API_KEY") || "";
    const workflowId = Deno.env.get("DIDIT_WORKFLOW_ID") || "";
    if (!apiKey || !workflowId) throw new AccountError("Identity verification is unavailable. Use manual review or retry later.", 503);
    await recordRegistrationAttempt(client, request, { action: "account_didit_session", email: user.email, userId: user.id });
    lease = crypto.randomUUID();
    const claimed = await client.rpc("claim_account_identity_session", { p_user_id: user.id, p_lease: lease });
    if (claimed.error) throw new AccountError("Identity verification could not start. Refresh your registration and retry.", 409);
    if (!claimed.data) return jsonResponse(await registrationState(client, user));
    const callback = new URL(`${Deno.env.get("SUPABASE_URL")}/functions/v1/verification-redirect`);
    const returnUrl = identityReturnUrl(body.redirectTo, Deno.env.get("TRABAWHO_APP_URL") || "", Deno.env.get("IDENTITY_ALLOWED_ORIGINS") || "");
    returnUrl.pathname = "/register"; returnUrl.hash = "";
    callback.searchParams.set("redirect_to", returnUrl.toString());
    const response = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ workflow_id: workflowId, vendor_data: `${user.id}:${lease}`, callback: callback.toString(), callback_method: "both", language: "en",
        contact_details: { email: user.email, send_notification_emails: false }, metadata: { account_id: user.id, registration_version: 2 } }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new AccountError("Didit could not start verification. Retry or use manual review.", 503);
    const created = asRecord(await response.json()); const sessionId = text(created.session_id); const url = text(created.url);
    if (!sessionId || !url.startsWith("https://")) throw new AccountError("Didit did not return a usable session.", 503);
    const saved = await client.rpc("attach_account_identity_session", { p_user_id: user.id, p_lease: lease, p_session_id: sessionId, p_url: url });
    if (saved.error) throw new AccountError("The verification session could not be saved. Retry.", 503);
    lease = null;
    return jsonResponse(await registrationState(client, user));
  } catch (cause) {
    if (lease && userId) await client.from("account_registrations").update({ creation_lease: null, creation_started_at: null }).eq("user_id", userId).eq("creation_lease", lease);
    const error = cause instanceof AccountError ? cause : new AccountError("Verification could not be completed. Retry.", 503);
    return jsonResponse({ error: error.message }, error.status);
  }
});
