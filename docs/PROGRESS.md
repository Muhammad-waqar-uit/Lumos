# Lumos - Progress Log

Chronological record of what has been built. Newest entries first within each date.

## 2026-10-15

### Done — test gate (vitest)
- [x] Both open PRs merged into `main` (`#1` tooling and rules, `#2` markdown viewer); `main` is now `df44395`
- [x] vitest 5 added at the root, to `@lumos/vault-utils` and to the daemon; `pnpm test` runs every workspace that has a suite
- [x] 34 tests for `@lumos/vault-utils`: slugify, title choice, frontmatter parse/serialize (BOM, CRLF, unterminated block, string tag), save/read/list and search against a temp vault
- [x] 32 tests for the daemon: `parseMessage` for every command and for malformed input, plus `handleMessage` filing real notes into a temp vault
- [x] `pnpm validate` now runs the tests between typecheck and build, so the pre-push hook cannot let a red suite through
- [x] The gate was shown to fail, not just pass: mutating `slugify`'s trailing-dash trim turned the suite red (exit 1); the file was restored and the diff checked clean
- [x] Two findings from writing the tests, recorded in `TODO.md`: `/help` does not list itself, and the filing reply echoes the title exactly as typed

### Done (continued) — `/find`
- [x] `/find <query>` answers with real results instead of "Search isn't built yet.", reusing `searchNotes` from `@lumos/vault-utils` so the command and `GET /notes/search` share one definition
- [x] Replies are capped at five matches with "and N more.", and an empty query asks for one instead of searching for nothing
- [x] Written test-first: five tests added to `src/handler.test.ts` failed against the stub, then passed once it was implemented (37 daemon tests now)
- [x] Exercised over real HTTP against a temporary vault on a spare port — `/find zeta` returned both matching notes across Ideas and Goals, `/find ZETA` matched case-insensitively, no-match and empty-query replies were correct, then the daemon was stopped and the temp vault deleted

### Next up
- [ ] Merge the pending branches in order: `test/vitest-gate`, then `ci/validate-workflow` (GitHub Actions on every PR), then `feat/daemon-find`
- [ ] Branch protection on `main` — a repository setting, and it needs the workflow on `main` first
- [ ] Route tests for the read API (needs a Fastify factory extracted from `server.ts`)
- [ ] Tag filtering + syntax highlighting for fenced code
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
