import { supabase } from "@/integrations/supabase";
import type { Database } from "@/integrations/supabase/database.types";
import type { BoostDraft } from "../utils/gigBoost";

export type BoostService = Pick<Database["public"]["Tables"]["services"]["Row"], "id" | "title" | "metadata">;
export interface BoostVerification { status: string; verified: boolean; requiresReview: boolean; serviceId: number; endsAt: string | null }
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};

async function invocationError(error: unknown) {
  const context = record(error).context;
  if (context instanceof Response) {
    const payload = record(await context.clone().json().catch(() => ({})));
    if (typeof payload.error === "string") return new Error(payload.error.slice(0, 240));
  }
  return new Error("Unable to contact payment checkout. Please retry.");
}

export async function fetchBoostServices(sellerId: string): Promise<BoostService[]> {
  const { data, error } = await supabase.from("services").select("id, title, metadata").eq("seller_id", sellerId).eq("active", true).order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load your gigs. Please retry.");
  return data || [];
}

const memory = new Map<string, { id: string; expires: number }>();
function boostOperation(key: string) {
  let operation = memory.get(key);
  try {
    const saved = record(JSON.parse(window.sessionStorage.getItem(key) || "null"));
    if (typeof saved.id === "string" && typeof saved.expires === "number") operation = { id: saved.id, expires: saved.expires };
  } catch { /* Memory preserves retries if storage is disabled. */ }
  if (!operation || operation.expires <= Date.now()) operation = { id: `boost:${crypto.randomUUID()}`, expires: Date.now() + 15 * 60_000 };
  memory.set(key, operation);
  try { window.sessionStorage.setItem(key, JSON.stringify(operation)); } catch { /* Memory fallback. */ }
  return operation.id;
}

export async function createBoostCheckout(sellerId: string, draft: BoostDraft) {
  const key = `trabawho:boost:${sellerId}:${draft.serviceId}:${draft.days}:${draft.amount}`;
  const rawResponse: unknown = await supabase.functions.invoke<unknown>("create-paymongo-boost-checkout", {
    body: { serviceId: draft.serviceId, days: draft.days, amount: draft.amount, operationId: boostOperation(key) },
  });
  const { data, error } = record(rawResponse);
  if (error) {
    memory.delete(key);
    try { window.sessionStorage.removeItem(key); } catch { /* Storage unavailable. */ }
    throw await invocationError(error);
  }
  const response = record(data);
  let url: URL;
  try { url = new URL(String(response.checkoutUrl)); } catch { throw new Error("PayMongo returned an invalid checkout link."); }
  if (url.protocol !== "https:" || url.hostname !== "checkout.paymongo.com" || typeof response.attemptId !== "string") throw new Error("PayMongo returned an invalid checkout link.");
  return { checkoutUrl: url.toString(), attemptId: response.attemptId };
}

export async function verifyBoostCheckout(attemptId: string): Promise<BoostVerification> {
  const rawResponse: unknown = await supabase.functions.invoke<unknown>("reconcile-paymongo-boost-checkout", { body: { attemptId } });
  const { data, error } = record(rawResponse);
  if (error) throw await invocationError(error);
  const response = record(data);
  if (typeof response.status !== "string" || typeof response.verified !== "boolean" || typeof response.serviceId !== "number") throw new Error("Payment verification is unavailable. Please retry.");
  return { status: response.status, verified: response.verified, requiresReview: response.requiresReview === true,
    serviceId: response.serviceId, endsAt: typeof response.endsAt === "string" ? response.endsAt : null };
}
