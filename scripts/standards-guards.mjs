import fs from "node:fs";
import path from "node:path";

export const checkedSourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);

export function countLines(content) {
  return content.split(/\r?\n/).length;
}

export function collectFiles(root, extensions = checkedSourceExtensions) {
  const files = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (extensions.has(path.extname(entry.name))) {
        files.push({
          absolutePath,
          path: path.relative(process.cwd(), absolutePath).replaceAll("\\", "/"),
          extension: path.extname(entry.name),
          lines: countLines(fs.readFileSync(absolutePath, "utf8")),
        });
      }
    }
  }

  visit(root);
  return files;
}

export function validateFileSizes(files, legacyEntries, temporaryEntries) {
  const failures = [];
  const legacy = new Map(legacyEntries.map((entry) => [entry.path, entry]));
  const temporary = new Map(temporaryEntries.map((entry) => [entry.path, entry]));
  const paths = new Set(files.map((file) => file.path));

  for (const file of files) {
    const legacyEntry = legacy.get(file.path);
    const temporaryEntry = temporary.get(file.path);

    if (legacyEntry) {
      if (![".js", ".jsx", ".css"].includes(file.extension)) {
        failures.push(`${file.path}: TypeScript files cannot use a legacy size exception`);
      } else if (file.lines > legacyEntry.baselineLines) {
        failures.push(`${file.path}: grew from its ${legacyEntry.baselineLines}-line legacy baseline to ${file.lines}`);
      } else if (file.lines <= 500) {
        failures.push(`${file.path}: now ${file.lines} lines; remove its stale legacy size exception`);
      } else if (file.lines < legacyEntry.baselineLines) {
        failures.push(`${file.path}: shrank to ${file.lines} lines; lower its baseline to ratchet the improvement`);
      }
      continue;
    }

    if (file.lines <= 500) continue;
    if (file.lines > 600) {
      failures.push(`${file.path}: ${file.lines} lines; files over 600 lines are prohibited`);
      continue;
    }
    if (!temporaryEntry) {
      failures.push(`${file.path}: ${file.lines} lines; 501-600 lines requires a documented temporary exception`);
    }
  }

  for (const entry of [...legacyEntries, ...temporaryEntries]) {
    if (!paths.has(entry.path)) failures.push(`${entry.path}: stale size exception; file does not exist`);
  }

  for (const entry of temporaryEntries) {
    const file = files.find((candidate) => candidate.path === entry.path);
    if (file && (file.lines <= 500 || file.lines > 600)) {
      failures.push(`${entry.path}: temporary exception applies only to files between 501 and 600 lines`);
    }
    for (const field of ["justification", "owner", "removalMilestone"]) {
      if (!entry[field]?.trim()) failures.push(`${entry.path}: temporary exception is missing ${field}`);
    }
  }

  return failures;
}

export function validateLegacySources(files, allowedPaths) {
  const actual = new Set(files.filter((file) => [".js", ".jsx"].includes(file.extension)).map((file) => file.path));
  const allowed = new Set(allowedPaths);
  const failures = [];

  for (const filePath of actual) {
    if (!allowed.has(filePath)) failures.push(`${filePath}: new JavaScript/JSX source is prohibited; use TypeScript`);
  }
  for (const filePath of allowed) {
    if (!actual.has(filePath)) failures.push(`${filePath}: stale legacy source entry; remove it from the allowlist`);
  }
  return failures;
}

export function validateStyles(files, styleEntries) {
  const cssFiles = files.filter((file) => file.extension === ".css");
  const styles = new Map(styleEntries.map((entry) => [entry.path, entry]));
  const actual = new Set(cssFiles.map((file) => file.path));
  const failures = [];

  for (const file of cssFiles) {
    const entry = styles.get(file.path);
    if (!entry) {
      failures.push(`${file.path}: unauthorized stylesheet; use Tailwind or add a documented exceptional approval`);
      continue;
    }
    if (entry.kind === "foundation" && file.lines > 500) {
      failures.push(`${file.path}: foundation stylesheet exceeds the 500-line limit`);
    }
    if (entry.kind === "legacy" && file.lines !== entry.baselineLines) {
      const action = file.lines < entry.baselineLines ? "lower the recorded baseline" : "remove new rules and use Tailwind";
      failures.push(`${file.path}: ${file.lines} lines does not match the ${entry.baselineLines}-line legacy baseline; ${action}`);
    }
  }

  for (const entry of styleEntries) {
    if (!actual.has(entry.path)) failures.push(`${entry.path}: stale stylesheet approval`);
    if (!entry.justification?.trim()) failures.push(`${entry.path}: stylesheet approval is missing justification`);
  }
  return failures;
}
