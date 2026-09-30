import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

export type UnknownRecord = Record<string, unknown>;

export const paymentCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const paymentJsonResponse = (payload: UnknownRecord, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...paymentCorsHeaders,
      "Content-Type": "application/json",
    },
  });

export const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};

export const cleanPaymentString = (value: unknown) => String(value ?? "").trim();

export const parsePaymentJson = async (request: Request): Promise<UnknownRecord> => {
  try {
    return asRecord(await request.json());
  } catch {
    return {};
  }
};

const getSupabaseEnvironment = () => {
  const url = cleanPaymentString(Deno.env.get("SUPABASE_URL"));
  const anonKey = cleanPaymentString(Deno.env.get("SUPABASE_ANON_KEY"));
  const serviceRoleKey = cleanPaymentString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase payment function environment is incomplete.");
  }
  return { url, anonKey, serviceRoleKey };
};

export const createPaymentAdminClient = (): SupabaseClient => {
  const { url, serviceRoleKey } = getSupabaseEnvironment();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

export const createPaymentUserClient = (request: Request): SupabaseClient => {
  const authorization = cleanPaymentString(request.headers.get("authorization"));
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new PaymentFunctionError("Sign in before starting payment.", 401);
  }

  const { url, anonKey } = getSupabaseEnvironment();
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
};

export class PaymentFunctionError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PaymentFunctionError";
    this.status = status;
  }
}

export const sha256PaymentHex = async (message: string) => {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const hmacSha256PaymentHex = async (message: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const parsePayMongoSignature = (header: string) =>
  header.split(",").reduce<Record<string, string>>((parts, entry) => {
    const separator = entry.indexOf("=");
    if (separator <= 0) return parts;
    parts[entry.slice(0, separator).trim()] = entry.slice(separator + 1).trim().toLowerCase();
    return parts;
  }, {});

export const verifyPayMongoSignature = async ({
  rawBody,
  signatureHeader,
  webhookSecret,
  toleranceSeconds = 300,
}: {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
  toleranceSeconds?: number;
}) => {
  const parts = parsePayMongoSignature(signatureHeader);
  const timestamp = Number.parseInt(parts.t || "", 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const expected = await hmacSha256PaymentHex(`${parts.t}.${rawBody}`, webhookSecret);
  const candidate = parts.te || parts.li || "";
  return Boolean(candidate) && constantTimeEqual(expected, candidate);
};

export const safePaymentError = (error: unknown) => {
  if (error instanceof PaymentFunctionError) return error;
  return new PaymentFunctionError("Unable to process payment right now. Please try again.", 500);
};
