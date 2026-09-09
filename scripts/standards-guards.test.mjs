import assert from "node:assert/strict";
import test from "node:test";
import { validateFileSizes, validateLegacySources, validateStyles } from "./standards-guards.mjs";

const file = (path, lines, extension = path.slice(path.lastIndexOf("."))) => ({ path, lines, extension });

test("rejects an unapproved file above 500 lines", () => {
  const failures = validateFileSizes([file("src/new.tsx", 501)], [], []);
  assert.match(failures.join("\n"), /requires a documented temporary exception/);
});

test("accepts a complete temporary exception between 501 and 600 lines", () => {
  const failures = validateFileSizes([file("src/review.tsx", 550)], [], [{
    path: "src/review.tsx",
    justification: "A single cohesive parser pending extraction.",
    owner: "frontend",
    removalMilestone: "parser-v2",
  }]);
  assert.deepEqual(failures, []);
});

test("rejects files over 600 lines without a legacy baseline", () => {
  const failures = validateFileSizes([file("src/new.tsx", 601)], [], []);
  assert.match(failures.join("\n"), /over 600 lines are prohibited/);
});

test("rejects growth and stale entries in the shrinking legacy baseline", () => {
  const legacy = [{ path: "src/legacy.jsx", baselineLines: 700 }];
  assert.match(validateFileSizes([file("src/legacy.jsx", 701, ".jsx")], legacy, []).join("\n"), /grew/);
  assert.match(validateFileSizes([file("src/legacy.jsx", 499, ".jsx")], legacy, []).join("\n"), /stale/);
});

test("rejects new JavaScript and stale JavaScript allowlist entries", () => {
  const failures = validateLegacySources(
    [file("src/new.jsx", 10, ".jsx")],
    ["src/removed.js"],
  );
  assert.match(failures.join("\n"), /new JavaScript\/JSX source/);
  assert.match(failures.join("\n"), /stale legacy source entry/);
});

test("rejects unauthorized CSS and changes to the frozen legacy baseline", () => {
  const unauthorized = validateStyles([file("src/feature.css", 10, ".css")], []);
  assert.match(unauthorized.join("\n"), /unauthorized stylesheet/);

  const changed = validateStyles(
    [file("src/legacy.css", 99, ".css")],
    [{ path: "src/legacy.css", kind: "legacy", baselineLines: 100, justification: "Migration bridge." }],
  );
  assert.match(changed.join("\n"), /lower the recorded baseline/);
});
