# Lumos - Master TODO

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · Priority: P0 critical, P1 high, P2 medium, P3 low

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

## Phase 2: Shared Packages (P0)
- [x] `packages/shared`: core types (Note, Frontmatter, Command, VaultEntry)
- [x] `packages/vault-utils`: vault ops (read/list/search/parse/write, slugify)
- [x] Configure pnpm workspace + tsconfig for packages
- [x] Refactor daemon to use shared packages

## Phase 3: Daemon Enhancements (P1)
- [x] Read API for the desktop: `GET /notes`, `/notes/search`, `/folders`, `/note` (+ CORS, traversal guards)
- [ ] Link expansion for `/read` and `/interview` (title, description, og:image)
- [ ] Implement `/find <query>` search over the vault
- [ ] `/plan today|tomorrow` with Ollama integration
- [ ] Tag extraction / auto-tagging (`#tag`)
- [ ] Config file support (dotenv / JSON)
- [ ] Richer error messages and logging
- [ ] Unit tests for commands / parser / vault

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
- [~] Note viewer - renders note text; Markdown rendering (react-markdown) pending
- [ ] Tag filtering

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
