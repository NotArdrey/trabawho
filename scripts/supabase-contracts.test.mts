import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { probeTable, scanContracts } from "./supabase-contracts.mts";

test("scans payload columns, nested selections, and legacy adapter calls without treating JSON keys as columns", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "trabawho-contract-test-"));
  try {
    fs.writeFileSync(path.join(directory, "queries.ts"), `
      declare const client: { from(table: string): { select(selection: string): { eq(column: string, value: string): unknown }; update(payload: object): unknown; insert(payload: object[]): unknown } };
      declare function fetchRowsByIds(table: string, column: string, ids: string[], select: string): unknown;
      declare function runBookingWorkflowRpc(name: string, id: string, options: { rpcParams: object }): unknown;
      declare function updateServiceSlot(input: { slotId: number, updates: object }): unknown;
      declare function updateRegistrationAttempt(client: object, id: string, updates: object): unknown;
      client.from("services").update({ title: "Repair", metadata: { booking_mode: "with-slots" } });
      client.from("bookings").select("id,services(title,sellers(display_name))").eq("seller_id", "worker-1");
      const payload = { body: "Hello", attachments: { type: "quote", amount: 850 } };
      client.from("messages").insert([payload]);
      fetchRowsByIds("profiles", "user_id", [], "full_name");
      runBookingWorkflowRpc("open_booking_dispute", "booking-1", { rpcParams: { p_reason: "Repair needed" } });
      updateServiceSlot({ slotId: 1, updates: { start_ts: "date", capacity: 2 } });
      updateRegistrationAttempt(client, "attempt-1", { success: true, reason: "saved" });
      Array.from([]);
    `);
    const scan = scanContracts([directory]);
    assert.deepEqual([...scan.tables.get("services")!.columns].sort(), ["metadata", "title"]);
    assert.deepEqual([...scan.tables.get("messages")!.columns].sort(), ["attachments", "body"]);
    assert.deepEqual([...scan.tables.get("bookings")!.columns].sort(), ["id", "seller_id"]);
    assert.deepEqual([...scan.tables.get("sellers")!.columns], ["display_name"]);
    assert.deepEqual([...scan.tables.get("profiles")!.columns].sort(), ["full_name", "user_id"]);
    assert.deepEqual([...scan.tables.get("service_slots")!.columns].sort(), ["capacity", "start_ts"]);
    assert.deepEqual([...scan.tables.get("registration_attempts")!.columns].sort(), ["reason", "success"]);
    assert.deepEqual([...scan.rpcs.get("open_booking_dispute")!].sort(), ["p_booking_id", "p_idempotency_key", "p_reason"]);
    assert.deepEqual(scan.unresolved, []);
  } finally {
    const resolvedDirectory = fs.realpathSync(directory);
    const resolvedTempRoot = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolvedDirectory), resolvedTempRoot);
    assert.ok(path.basename(resolvedDirectory).startsWith("trabawho-contract-test-"));
    fs.rmSync(resolvedDirectory, { recursive: true, force: true });
  }
});

test("finds multiple missing columns with row-free GET requests", async (context) => {
  const requests: { url: string; init?: RequestInit }[] = [];
  context.mock.method(globalThis, "fetch", (input: URL | RequestInfo, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    const column = requests.length === 1 ? "payment_advance" : requests.length === 2 ? "gcash_number" : null;
    return Promise.resolve(new Response(JSON.stringify(column ? { code: "42703", message: `column sellers.${column} does not exist` } : []), { status: column ? 400 : 200 }));
  });
  const result = await probeTable({ table: "sellers", columns: new Set(["user_id", "payment_advance", "gcash_number"]), locations: new Set() }, "https://test.invalid", "public-test-key");
  assert.deepEqual(result.missing, ["payment_advance", "gcash_number"]);
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(new URL(request.url).searchParams.get("limit"), "0");
    assert.equal(request.init?.method, undefined);
    assert.equal(request.init?.body, undefined);
  }
});

test("keeps permission failures distinct from missing columns and hides server diagnostics", async (context) => {
  context.mock.method(globalThis, "fetch", () => Promise.resolve(new Response(JSON.stringify({ code: "42501", message: "private database diagnostic" }), { status: 401 })));
  const result = await probeTable({ table: "identity_review_actions", columns: new Set(["id"]), locations: new Set() }, "https://test.invalid", "public-test-key");
  assert.deepEqual(result.missing, []);
  assert.equal(result.unavailable, "401 42501");
  assert.ok(!JSON.stringify(result).includes("private database diagnostic"));
});
