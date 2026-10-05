import { deliverAccountConfirmation } from '../_shared/accountConfirmation.ts';
import { applyDraftEvent } from '../_shared/registrationDraftIdentity.ts';
import { buildIdentityDocumentFingerprint, corsHeaders, createAdminClient,
  jsonResponse, sanitizeIdentityVerificationData, sha256Hex } from "../_shared/identityRegistration.ts";
import { asRecord, resolveDiditDecisionStatus } from "../_shared/identityDomain.ts";
import { verifiedDocument } from "../_shared/accountRegistration.ts";
import { verifyDiditSignature } from "../_shared/diditSignature.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const rawBody = await req.text();
    let payload: Record<string, unknown>;
    try { payload = asRecord(JSON.parse(rawBody)); }
    catch { return jsonResponse({ error: "Invalid JSON" }, 400); }
    const secret = Deno.env.get("DIDIT_WEBHOOK_SECRET") || Deno.env.get("WEBHOOK_SECRET_KEY") || "";
    if (!(await verifyDiditSignature(rawBody, payload, req.headers, secret)))
      return jsonResponse({ error: "Invalid Didit webhook signature" }, 401);
    if (!["status.updated", "data.updated"].includes(String(payload.webhook_type)) || payload.session_kind === "business")
      return jsonResponse({ received: true, ignored: true });
    const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    const eventId = typeof payload.event_id === "string" ? payload.event_id : "";
    const status = resolveDiditDecisionStatus(payload);
    if (!sessionId || !eventId || !status) return jsonResponse({ error: "Missing session event fields" }, 400);
    const document = verifiedDocument(payload);
    const fingerprint: string | null = await buildIdentityDocumentFingerprint(payload);
    const sanitized: unknown = sanitizeIdentityVerificationData(payload);
    const client = createAdminClient();
    const event = {
      p_event_key: `didit:${eventId}`, p_payload_hash: await sha256Hex(rawBody), p_session_id: sessionId,
      p_status: status, p_payload: sanitized, p_document: { ...document, documentNumber: undefined }, p_fingerprint: fingerprint,
    };
    const draftResult = await applyDraftEvent(client,event);
    if (draftResult) return jsonResponse(draftResult);
    const {data,error} = await client.rpc("apply_didit_identity_event",event);
    if (error) throw new Error(error.code);
    const session = await client.from('verification_sessions').select('user_id').eq('session_ref',sessionId).maybeSingle();
    if (session.error) throw new Error('session_lookup_failed');
    const userId = asRecord(session.data).user_id;
    if (typeof userId==='string') await deliverAccountConfirmation(client,userId);
    return jsonResponse(asRecord(data));
  } catch (error) {
    console.error("didit_webhook_failed", { code: error instanceof Error ? error.message : "unknown" });
    return jsonResponse({ error: "The event could not be applied. Retry delivery." }, 500);
  }
});
