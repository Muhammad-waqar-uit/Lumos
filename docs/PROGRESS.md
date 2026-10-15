# Lumos - Progress Log

Chronological record of what has been built. Newest entries first within each date.

## 2026-10-15

### Done — vault graph view
- [x] `@lumos/vault-utils` gained a browser-safe graph module (its own `./graph` subpath): `extractLinks`/`extractTags` over note bodies, `buildGraphFromNotes` (notes + tags as nodes, links and tag references as edges, `inDegree`, `orphan`, unresolved targets reported rather than invented) and `neighborhood()` for hop-limited subgraphs
- [x] The module reads no filesystem, so the same code runs in the daemon and in the desktop bundle
- [x] Daemon: `GET /graph` returns the vault's graph; CORS and the vault-root guards stay in place
- [x] 41 new tests against a temporary vault (link forms, tag extraction, backlinks, orphans, unresolved links, neighbourhood depth); `@lumos/vault-utils` is now 75 tests and the suite is 107
- [x] Desktop: a Graph tab beside Notes — canvas force layout, glow nodes sized by backlink count, curved synapse edges, one hue per folder from the theme tokens, controls for tags, unlinked notes and depth
- [x] Clicking a node selects it (panel shows in/out degree, with a button that opens the note in the Notes view); hovering pulls its links forward and draws the label
- [x] Offline path exercised with the daemon stopped: the pane renders "Offline — demo vault" and the demo graph instead of a blank screen (4,064 painted pixels, 5 notes, 9 links)
- [x] Verified in the browser at pixel level: node cores in the intended per-folder hues, edge-coloured and tag-coloured line pixels present, painters running (~570 curves/second); the depth-1 result (4 notes, 7 links, 1 unresolved) matched an independent recomputation of `neighborhood()` against the daemon's own data — no console errors
- [x] Two real defects found and fixed on the way: the React wrapper for the graph renderer silently drops its canvas-object props, so the pane now drives the library's vanilla instance API; and Tailwind pruned the palette-step tokens that only TypeScript referenced, so the `--color-graph-*` values are plain `:root` custom properties. A failed lazy chunk used to leave a blank app — it now renders an error with a retry

### Done — test gate (vitest)
- [x] Both open PRs merged into `main` (`#1` tooling and rules, `#2` markdown viewer); `main` is now `df44395`
- [x] vitest 5 added at the root, to `@lumos/vault-utils` and to the daemon; `pnpm test` runs every workspace that has a suite
- [x] 34 tests for `@lumos/vault-utils`: slugify, title choice, frontmatter parse/serialize (BOM, CRLF, unterminated block, string tag), save/read/list and search against a temp vault
- [x] 32 tests for the daemon: `parseMessage` for every command and for malformed input, plus `handleMessage` filing real notes into a temp vault
- [x] `pnpm validate` now runs the tests between typecheck and build, so the pre-push hook cannot let a red suite through
- [x] The gate was shown to fail, not just pass: mutating `slugify`'s trailing-dash trim turned the suite red (exit 1); the file was restored and the diff checked clean
- [x] Two findings from writing the tests, recorded in `TODO.md`: `/help` does not list itself, and the filing reply echoes the title exactly as typed

### Done — CI gate (`.github/workflows/validate.yml`)
- [x] The gate the local hooks run now also runs on the repository: every PR into `main` and every push to `main`
- [x] pnpm's version comes from the `packageManager` field in `package.json` (nothing to keep in sync by hand); Node 24, with pnpm's store cached off `pnpm-lock.yaml`
- [x] The validate step calls `pnpm run validate`, so the workflow never restates the gate — the suites that landed with `test/vitest-gate` (PR #3) ride inside it
- [x] Pinned `actions/checkout@v7`, `actions/setup-node@v7` and `pnpm/action-setup@v6`: the v4-era actions run on a Node 20 runtime that GitHub removed in September 2026
- [x] Verified locally: the YAML parses to the intended shape (triggers, five steps, concurrency group), prettier accepts it, and `pnpm install --frozen-lockfile` then `pnpm run validate` both exit 0
- [x] Exercised on the pull request itself, not just described: the `pnpm validate` check ran on PR #4 and finished green (run `38783175553`), so the gate works before it exists on `main`
- [x] Landed on `main` (PR #4, `aaa7571`) and the first run on `main` is green: run `38790615355`, push event, every step passed
- [!] Branch protection is repository-side and still off: the check is not yet required to merge

### Done (continued) — `/find`
- [x] `/find <query>` answers with real results instead of "Search isn't built yet.", reusing `searchNotes` from `@lumos/vault-utils` so the command and `GET /notes/search` share one definition
- [x] Replies are capped at five matches with "and N more.", and an empty query asks for one instead of searching for nothing
- [x] Written test-first: five tests added to `src/handler.test.ts` failed against the stub, then passed once it was implemented (37 daemon tests now)
- [x] Exercised over real HTTP against a temporary vault on a spare port — `/find zeta` returned both matching notes across Ideas and Goals, `/find ZETA` matched case-insensitively, no-match and empty-query replies were correct, then the daemon was stopped and the temp vault deleted

### Next up
- [ ] Turn on branch protection on `main` so the green `pnpm validate` check is required to merge (the workflow itself runs on every PR and every push)
- [ ] Route tests for the read API (needs a Fastify factory extracted from `server.ts`)
- [ ] Tag filtering + syntax highlighting for fenced code
- [ ] Graph follow-ups: a backlinks panel in the note viewer, tag nodes styled and clickable apart from notes
- [ ] Resizable panes, TanStack Router, zustand
- [ ] Phase 3: link expansion, `/plan` with Ollama, tagging

## 2026-10-13

### Done
- [x] Monorepo scaffold with pnpm workspaces (`apps/daemon`, `apps/desktop`, `packages`)
- [x] Daemon core: command parser, vault writer, handler, Fastify server
- [x] WhatsApp bridge via Baileys (QR auth, allowlist, auto-reconnect)
- [x] HTTP API: `POST /message`, `GET /health`
- [x] `.gitignore`, `LICENSE` (MIT), README
- [x] Desktop app scaffolded (Tauri + React + TypeScript)
- [x] Repository pushed to GitHub (`Muhammad-waqar-uit/Lumos`)

### Done (continued)
- [x] Phase 1: tracking + reference docs (`PLAN.md`, `TODO.md`, `PROGRESS.md`, `FEATURES.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/*`)
- [x] Phase 2: `@lumos/shared` (types) and `@lumos/vault-utils` (slugify, parse/serialize, read/list/search/write)
- [x] Refactored the daemon onto the shared packages; `handleMessage` + vault round-trip verified with `tsx`
- [x] `tsc --noEmit` passes for daemon, shared, and vault-utils

### Done (continued 2)
- [x] Daemon read API: `GET /notes`, `/notes/search`, `/folders`, `/note` (+ CORS for local origins, path-traversal and folder guards)
- [x] Desktop dark UI: Tailwind v4 tokens, three-pane shell (Sidebar, NoteList, NoteViewer, StatusBar)
- [x] Desktop loads the vault from the daemon with a demo fallback when it is offline
- [x] Verified live in the browser: real notes listed, opened, and searched; no console errors
- [x] `tsc --noEmit` passes for daemon + desktop; `vite build` succeeds; `/note` traversal returns 400

### Done (continued 3) — tooling, enforcement and workflow
- [x] oxlint replaces the ad-hoc check (TS-version compatible) and prettier owns formatting
- [x] Husky + lint-staged + commitlint installed; hooks cannot be bypassed
- [x] Root scripts added: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `build`, `validate`
- [x] `pre-commit` now also refuses to commit on `main`, so the branch workflow is enforced by the tooling
- [x] Unified TypeScript `~6.0.3` across all four workspaces; `typecheck` script in every workspace
- [x] `RULES.md`, `AGENTS.md` and `CLAUDE.md` written; `CONTRIBUTING.md` and `README.md` point at them
- [x] Branching model adopted: short-lived `<type>/<description>` branches, PR into `main`, squash-merge, no direct commits
- [x] Generated Tauri schemas excluded from formatting; `pnpm validate` verified green end to end
- [x] Fixed two real lint findings in the desktop app by deriving state at render instead of repairing it in effects

### Done (continued 4) — Markdown note rendering
- [x] Note bodies render as Markdown (`react-markdown` + `remark-gfm`) instead of preformatted text
- [x] GFM coverage: headings, nested lists, ordered lists, tables, task lists, blockquotes, fenced code
- [x] Note links open externally (`target="_blank"`, `rel="noreferrer"`) so the window never navigates away
- [x] `.markdown` styles in `index.css` use the existing dark tokens — no hex values in a component
- [x] Verified against the running daemon: an 11-block note renders with the expected DOM elements and computed styles, all requests 200, no console errors

## Template for new entries

```
## YYYY-MM-DD
### Done
- [x] ...
### In progress
- [~] ...
### Blocked
- [!] ... (reason)
```
