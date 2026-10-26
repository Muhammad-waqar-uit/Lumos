#!/usr/bin/env node
/**
 * gen-test-counts.mjs - the test-counts gate.
 *
 * Every workspace's `pnpm test` writes a `vitest-report.json` next to its package
 * (gitignored). This script reads those reports, builds a Markdown table, and either
 * writes it to `docs/TESTING.md` (`--write`) or fails when the committed file no
 * longer matches the reports (default).
 *
 * The point is that no one types a test count into a document again: the number a
 * reader sees comes from the same run that proved it, and `pnpm validate` fails the
 * moment the two disagree.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(repoRoot, "docs", "TESTING.md");
const write = process.argv.includes("--write");

/** Every workspace directory that has a package.json (apps/*, packages/*, e2e). */
function workspaceDirs() {
  const dirs = [];
  for (const parent of ["apps", "packages"]) {
    const base = join(repoRoot, parent);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const dir = join(base, name);
      if (existsSync(join(dir, "package.json"))) dirs.push(dir);
    }
  }
  if (existsSync(join(repoRoot, "e2e", "package.json"))) dirs.push(join(repoRoot, "e2e"));
  return dirs;
}

/**
 * The workspaces whose `test` script runs vitest - the only ones that write a
 * report. A workspace without a `test` script (or whose test script is not
 * vitest, like e2e's Playwright) is not counted here.
 */
const suites = [];
for (const dir of workspaceDirs()) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (!pkg.scripts || !pkg.scripts.test || !pkg.scripts.test.includes("vitest")) continue;
  const reportPath = join(dir, "vitest-report.json");
  if (!existsSync(reportPath)) {
    console.error(
      `gen-test-counts: no report for ${pkg.name} at ${reportPath}\n` +
        `Run 'pnpm test' first (it writes one per suite), or 'pnpm counts:update'.`,
    );
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  suites.push({
    name: pkg.name,
    tests: report.numTotalTests,
    files: report.testResults ? report.testResults.length : 0,
    failed: report.numFailedTests,
  });
}

if (suites.length === 0) {
  console.error("gen-test-counts: found no workspace with a vitest test script");
  process.exit(1);
}

const total = suites.reduce(
  (acc, s) => ({ tests: acc.tests + s.tests, files: acc.files + s.files }),
  { tests: 0, files: 0 },
);

const lines = [
  "# Test counts",
  "",
  "<!--",
  "  GENERATED FILE - do not edit by hand.",
  "  Produced by scripts/gen-test-counts.mjs from each workspace's vitest JSON report.",
  "  Regenerate with `pnpm counts:update`; `pnpm validate` fails when this file and the",
  "  reports disagree, so a number here can never drift from what the suite actually ran.",
  "-->",
  "",
  "Counts come from the last `pnpm test`: every suite writes a `vitest-report.json`",
  "(gitignored) beside its package, and this table is read from those files. What each",
  "suite covers is described in [FEATURES.md](FEATURES.md); the Playwright smoke suite",
  "(`pnpm test:e2e`, 5 tests) drives the built app in a real browser and is separate",
  "from `pnpm validate`.",
  "",
  "| Workspace | Tests | Test files |",
  "| --- | ---: | ---: |",
  ...suites.map((s) => `| \`${s.name}\` | ${s.tests} | ${s.files} |`),
  `| **Total** | **${total.tests}** | **${total.files}** |`,
  "",
];

const generated = lines.join("\n");

if (suites.some((s) => s.failed > 0)) {
  console.error(
    `gen-test-counts: ${suites.filter((s) => s.failed > 0).length} suite(s) report failing tests - fix them before counting them`,
  );
  process.exit(1);
}

if (write) {
  writeFileSync(outFile, generated);
  console.log(
    `gen-test-counts: wrote docs/TESTING.md (${total.tests} tests in ${total.files} files)`,
  );
} else {
  const committed = existsSync(outFile) ? readFileSync(outFile, "utf8") : "";
  if (committed !== generated) {
    console.error(
      "gen-test-counts: docs/TESTING.md is out of date with the test reports.\n" +
        "Run `pnpm counts:update` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`gen-test-counts: docs/TESTING.md matches the reports (${total.tests} tests)`);
}
