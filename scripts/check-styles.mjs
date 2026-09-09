import fs from "node:fs";
import path from "node:path";
import { collectFiles, validateStyles } from "./standards-guards.mjs";

const files = collectFiles(path.resolve("src"));
const approvals = JSON.parse(fs.readFileSync(path.resolve("scripts/style-source-allowlist.json"), "utf8"));
const failures = validateStyles(files, approvals);

if (failures.length) {
  console.error("Stylesheet standard failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Stylesheet standard passed.");
}
