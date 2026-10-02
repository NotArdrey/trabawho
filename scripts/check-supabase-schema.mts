import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";
import { probeTable, scanContracts } from "./supabase-contracts.mts";

const scan = scanContracts();
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const url = env.VITE_SUPABASE_URL || env.REACT_APP_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || env.REACT_APP_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Set the public Supabase URL and anonymous key before running the schema audit.");

console.log(`Scanned ${scan.files} application and Edge Function source files.`);
let failures = 0;
let unavailable = 0;
let checked = 0;
const tables = [...scan.tables.values()];
for (let offset = 0; offset < tables.length; offset += 4) {
  const results = await Promise.all(tables.slice(offset, offset + 4).map(async (use) => {
    try { return await probeTable(use, url, key); }
    catch { return { table: use.table, checked: 0, missing: [], unavailable: "network failure or timeout" }; }
  }));
  for (const result of results) {
    checked += result.checked;
    if (result.missing.length) { failures++; console.error(`${result.table}: missing ${result.missing.join(", ")}`); }
    if (result.unavailable) { unavailable++; console.error(`${result.table}: could not verify (${result.unavailable})`); }
  }
}

// Validate RPC names and argument keys against migration history. Do not execute RPCs for discovery.
const migrations = fs.readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
const signatures = new Map<string, Set<string>[]>();
for (const file of migrations) {
  const sql = fs.readFileSync(path.join("supabase/migrations", file), "utf8");
  for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([^]*?)\)\s*returns/gi)) {
    const args = new Set([...match[2].matchAll(/\b(p_\w+)\s+/g)].map((arg) => arg[1]));
    const overloads = signatures.get(match[1]) ?? [];
    overloads.push(args); signatures.set(match[1], overloads);
  }
}
for (const [name, args] of scan.rpcs) {
  if (!signatures.get(name)?.some((keys) => [...args].every((arg) => keys.has(arg)))) {
    failures++; console.error(`RPC ${name}: name/arguments do not match a checked-in migration.`);
  }
}
console.log(`Checked ${checked} columns across ${tables.length} tables using read-only requests; ${scan.rpcs.size} RPC contracts against migration history.`);
if (scan.unresolved.length) console.log(`Manual review required for dynamic contracts:\n${scan.unresolved.map((item) => `- ${item}`).join("\n")}`);
console.log("RPC deployment, RLS, storage policies, and signed-in writes require separate authenticated verification.");
console.log(`${failures} schema mismatches; ${unavailable} tables could not be verified.`);
process.exitCode = failures ? 1 : unavailable || scan.unresolved.length ? 2 : 0;
