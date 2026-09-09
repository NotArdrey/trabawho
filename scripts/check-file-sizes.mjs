import fs from "node:fs";
import path from "node:path";
import { collectFiles, validateFileSizes } from "./standards-guards.mjs";

const files = [
  ...collectFiles(path.resolve("src")),
  ...collectFiles(path.resolve("tests")),
  ...collectFiles(path.resolve("scripts")),
];
const legacyEntries = JSON.parse(fs.readFileSync(path.resolve("scripts/legacy-file-size-allowlist.json"), "utf8"));
const temporaryEntries = JSON.parse(fs.readFileSync(path.resolve("scripts/file-size-exceptions.json"), "utf8"));
const failures = validateFileSizes(files, legacyEntries, temporaryEntries);

if (failures.length > 0) {
  console.error("File-size standard failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("File-size standard passed.");
}
