import { asRecord } from "./identityDomain.ts";

// Serialize entries directly: rebuilding an object reorders integer-like keys.
export function canonicalDiditJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalDiditJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = asRecord(value);
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalDiditJson(record[key])}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("Unsupported webhook value.");
  return encoded;
}

export async function signDiditBody(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(b) || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.toLowerCase().charCodeAt(i);
  return difference === 0;
}

export async function verifyDiditSignature(rawBody: string, payload: unknown, headers: Headers, secret: string, now = Date.now()): Promise<boolean> {
  const timestamp = asRecord(payload).timestamp;
  const header = headers.get("x-timestamp");
  // Freshness must cover the signed body. The header alone is unsigned.
  if (!secret || typeof timestamp !== "number" || !Number.isInteger(timestamp) ||
    header !== String(timestamp) || Math.abs(Math.floor(now / 1000) - timestamp) > 300) return false;
  const v2 = headers.get("x-signature-v2");
  if (v2 && equalHex(await signDiditBody(canonicalDiditJson(payload), secret), v2)) return true;
  const raw = headers.get("x-signature");
  // The original signature signs raw bytes, without a timestamp prefix.
  return Boolean(raw && equalHex(await signDiditBody(rawBody, secret), raw));
  // Simple is intentionally unsupported: it does not authenticate the decision.
}
