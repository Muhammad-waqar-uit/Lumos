# Lumos - Master TODO

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · Priority: P0 critical, P1 high, P2 medium, P3 low

## Phase 0: Enforcement & Workflow (P0)
- [x] oxlint as the linter (kept in step with the TypeScript version), prettier as the formatter
- [x] Husky hooks: `pre-commit` (lint-staged), `commit-msg` (commitlint), `pre-push` (`pnpm validate`)
- [x] Root scripts: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `build`, `validate`
- [x] `pre-commit` refuses to commit while on `main` — the branch workflow is enforced, not just documented
- [x] `pnpm validate` = lint + format:check + typecheck + test + build
- [x] One TypeScript version (`~6.0.3`) across every workspace, with a `typecheck` script in each
- [x] `RULES.md` (build / commit / branch standards), `AGENTS.md` (agent working agreement), `CLAUDE.md`
- [x] Branching model in writing: short-lived `<type>/<description>` branches, PR into `main`, squash-merge
- [x] Generated Tauri schemas excluded from formatting; prettier clean across the repo

## Phase 0.1: Enforcement still to come (P1)
- [x] GitHub Actions workflow (`.github/workflows/validate.yml`) running `pnpm validate` on every PR into `main` and every push to `main`
- [ ] Branch protection on `main`: require a pull request and the `pnpm validate` check before merging (a repository setting; the workflow's first run on `main` was green in `38790615355`)
- [x] Test runner (vitest) wired up and added to the validation gate — 112 tests over `@lumos/vault-utils` and the daemon
- [ ] Schema validation for note frontmatter in CI
- [ ] Route tests for the read API — extract the Fastify app from `server.ts` so `app.inject()` can hit `/note`, `/notes`, `/folders`, `/graph` without binding a port
- [ ] Desktop component tests (jsdom + Testing Library) for the sidebar, list and viewer states

## Phase 1: Documentation & Tracking Foundation (P0)
- [x] Create `PLAN.md`
- [x] Create `TODO.md`
- [x] Create `PROGRESS.md`
- [x] Create `FEATURES.md`
- [x] Create `ARCHITECTURE.md`
- [x] Create `CONTRIBUTING.md`
- [x] Create `CHANGELOG.md`
- [x] Create `docs/daemon.md`
- [x] Create `docs/desktop.md`
- [x] Create `docs/vault.md`
- [x] Create `docs/design.md`
- [x] Create `docs/roadmap.md`
- [x] Update `README.md` with doc links
- [x] Move all docs into `docs/` (keeping `CHANGELOG.md` and `CONTRIBUTING.md` at root for GitHub conventions)
- [x] Link check over README + `docs/*.md` after every move

## Phase 2: Shared Packages (P0)
- [x] `packages/shared`: core types (Note, Frontmatter, Command, VaultEntry)
- [x] `packages/vault-utils`: vault ops (read/list/search/parse/write, slugify)
- [x] Configure pnpm workspace + tsconfig for packages
- [x] Refactor daemon to use shared packages

## Phase 3: Daemon Enhancements (P1)
- [x] Read API for the desktop: `GET /notes`, `/notes/search`, `/folders`, `/note`, `/graph` (+ CORS, traversal guards)
- [ ] Link expansion for `/read` and `/interview` (title, description, og:image)
- [x] Implement `/find <query>` search over the vault (title, tags, body; 5 matches per reply)
- [ ] `/plan today|tomorrow` with Ollama integration
- [ ] Tag extraction / auto-tagging (`#tag`)
- [ ] Config file support (dotenv / JSON)
- [ ] Richer error messages and logging
- [x] Unit tests for the parser and the vault operations (vitest, `pnpm test`)
- [ ] `/help` does not list itself in the command list it prints (found by the daemon tests)

## Phase 4: Desktop UI Foundation (P0)
- [x] Tailwind CSS v4 + dark shadcn-style design tokens (near-black)
- [x] Core components (Sidebar, NoteList, NoteViewer, StatusBar, search input)
- [x] App shell layout: sidebar + note list + note viewer + status bar
- [ ] Resizable panes
- [ ] TanStack Router setup
- [ ] zustand state management (currently plain React state)

## Phase 5: Vault Browser (P0)
- [x] Sidebar with vault folders + note counts
- [x] Note list pane (sorted by date, preview, tags)
- [x] Vault load on mount via the daemon read API (demo fallback when offline)
- [x] Note viewer - Markdown rendering via `react-markdown` + `remark-gfm` (headings, lists, tables, task lists, blockquotes, fenced code; note links open externally)
- [ ] Syntax highlighting for fenced code blocks (`rehype-highlight` or shiki)
- [ ] Tag filtering
- [x] Graph view: canvas link graph from `GET /graph` — glow nodes sized by backlinks, curved edges, one hue per folder, tag and unlinked filters, local depth around the open note, demo graph offline
- [ ] Graph: backlinks panel in the note viewer, fed by the same extracted links
- [ ] Graph: tag nodes styled apart from notes, and tag nodes clickable as a filter
- [ ] Graph: keep the node positions across tab switches instead of re-running the layout
- [ ] Graph: re-fit after the pane is resized — today the transform is kept, so the graph can sit off-centre until `Fit` (or a filter change) is used

## Phase 6: Search & Discovery (P1)
- [ ] Full-text search with fuse.js
- [ ] Cmd/Ctrl+K search modal
- [ ] Tag filtering UI
- [ ] Recent notes quick access
- [ ] Share search logic with daemon `/find`

## Phase 7: Editing & Enrichment (P2)
- [ ] Markdown editor with preview
- [ ] Edit/save notes to disk
- [ ] Link metadata enrichment + previews
- [ ] Bulk operations (move, tag, archive)

## Phase 8: Polish & Docs (P2)
- [ ] UI polish (empty/loading states, subtle transitions)
- [ ] Performance: lazy loading, list virtualization, search index
- [ ] Tests (daemon unit, desktop component, E2E smoke)
- [ ] Complete docs with screenshots and `USAGE.md`
