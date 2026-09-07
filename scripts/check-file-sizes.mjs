import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const sourceRoot = path.resolve("src");
const allowlistPath = path.resolve("scripts/legacy-file-size-allowlist.json");
const allowlist = new Set(JSON.parse(fs.readFileSync(allowlistPath, "utf8")));
const checkedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const failures = [];
const staleEntries = new Set(allowlist);

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(absolutePath);
      continue;
    }

    if (!checkedExtensions.has(path.extname(entry.name))) continue;

    const relativePath = path.relative(process.cwd(), absolutePath).replaceAll("\\", "/");
    const lineCount = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/).length;
    if (lineCount <= 600) continue;

    if (allowlist.has(relativePath)) {
      staleEntries.delete(relativePath);
      continue;
    }

    failures.push(`${relativePath}: ${lineCount} lines`);
  }
}

visit(sourceRoot);

for (const staleEntry of staleEntries) {
  failures.push(`${staleEntry}: stale or no longer over 600 lines; remove it from the allowlist`);
}

if (failures.length > 0) {
  console.error("File-size standard failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("File-size standard passed.");
}
