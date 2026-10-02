import { asRecord } from "./identityDomain.ts";

// Admin-only diagnostics return configuration facts, never provider credentials.
export async function identityIntegrationStatus() {
  const apiKey = Deno.env.get("DIDIT_API_KEY") || "";
  const workflowId = Deno.env.get("DIDIT_WORKFLOW_ID") || "";
  const webhookUrl = `${Deno.env.get("SUPABASE_URL") || ""}/functions/v1/didit-webhook`;
  const read = async (path: string) => {
    const response = await fetch(`https://verification.didit.me/v3/${path}`, {
      headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(8000),
    });
    return { httpStatus: response.status, data: response.ok ? await response.json() as unknown : null };
  };
  const [workflow, destinations] = await Promise.all([
    read(`workflows/${encodeURIComponent(workflowId)}/`), read("webhook/destinations/"),
  ]);
  const body = asRecord(destinations.data);
  const items = Array.isArray(destinations.data) ? destinations.data : Array.isArray(body.results) ? body.results : [];
  return {
    workflowHttpStatus: workflow.httpStatus, webhookHttpStatus: destinations.httpStatus,
    hasSigningSecret: Boolean(Deno.env.get("DIDIT_WEBHOOK_SECRET")),
    destinations: items.map((item: unknown) => {
      const entry = asRecord(item);
      return { matchesEndpoint: entry.url === webhookUrl, url: entry.url, version: entry.webhook_version,
        signingSecretMatches: typeof entry.secret_shared_key === "string" ? entry.secret_shared_key === Deno.env.get("DIDIT_WEBHOOK_SECRET") : null,
        events: entry.subscribed_events, enabled: entry.is_active ?? entry.enabled ?? null };
    }),
  };
}
