#!/usr/bin/env node
/**
 * Two things the docs must not do: point at a file that is not there, and leave a document that
 * nothing links to.
 *
 * Both go wrong quietly. A rename or an `rm` breaks a relative link and the page still renders; a
 * new document sits in `docs/` with no way in, which is what happened to the walkthrough before it
 * was added to USAGE. Neither is caught by lint, typecheck or a test, and both are cheap to check -
 * so they run in `pnpm validate` beside the rest of the gate.
 *
 * The documents are the Markdown git tracks. That is what excludes `node_modules`, the vault, build
 * output and a person's own ignored notes without this file having to keep a list. Test fixtures are
 * Markdown too but they are data, so a `fixtures` directory is skipped.
 *
 * Code is blanked before scanning: a link written inside backticks or a fence is documentation
 * *about* a link, not a link, and the progress log is full of those.
 */
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
/** Directories whose Markdown is test data rather than documentation. */
const SKIP_DIRS = new Set(["fixtures"]);
/** Documents that are entry points: nothing has to link to them. */
const ENTRIES = new Set(["README.md"]);

const run = promisify(execFile);

/** The Markdown files git tracks, which is the set a reader can be sent to. */
async function documents() {
  const { stdout } = await run("git", ["ls-files", "-z", "--", "*.md"], {
    cwd: ROOT,
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => !file.split("/").some((part) => SKIP_DIRS.has(part)))
    .map((file) => path.join(ROOT, file));
}

/** The text with fenced blocks and inline code removed, so an example link is not read as one. */
function prose(text) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

/** The relative targets one document links to, resolved against its own directory. */
function targets(file, text) {
  const here = path.dirname(file);
  const found = [];
  for (const match of prose(text).matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
    const clean = decodeURIComponent(target.split("#")[0]);
    if (clean) found.push({ target, resolved: path.resolve(here, clean) });
  }
  return found;
}

const relative = (file) => path.relative(ROOT, file).split(path.sep).join("/");

const files = await documents();
const problems = [];
const linked = new Set();

for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const { target, resolved } of targets(file, text)) {
    linked.add(resolved);
    try {
      await stat(resolved);
    } catch {
      problems.push(`${relative(file)} links to ${target}, which is not there`);
    }
  }
}

for (const file of files) {
  if (path.dirname(file) === ROOT && ENTRIES.has(path.basename(file))) continue;
  if (!linked.has(file)) problems.push(`${relative(file)} is not linked from any other document`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`docs: ${problem}`);
  console.error(`docs: ${problems.length} problem(s)`);
  process.exit(1);
}

console.log(`docs: ${files.length} documents, every link resolves and every one is reachable`);
