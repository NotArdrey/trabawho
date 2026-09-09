import fs from "node:fs";
import path from "node:path";
import { collectFiles, validateLegacySources } from "./standards-guards.mjs";

const files = [
  ...collectFiles(path.resolve("src")),
  ...collectFiles(path.resolve("tests")),
];
const allowlist = JSON.parse(fs.readFileSync(path.resolve("scripts/legacy-source-allowlist.json"), "utf8"));
const failures = validateLegacySources(files, allowlist);

if (failures.length) {
  console.error("Legacy-source standard failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Legacy-source standard passed.");
}
