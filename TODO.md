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
- [ ] `packages/shared`: core types (Note, Frontmatter, Command, VaultEntry)
- [ ] `packages/vault-utils`: vault ops (read/list/search/parse/write, slugify)
- [ ] Configure pnpm workspace + tsconfig for packages
- [ ] Refactor daemon to use shared packages

## Phase 3: Daemon Enhancements (P1)
- [ ] Link expansion for `/read` and `/interview` (title, description, og:image)
- [ ] Implement `/find <query>` search over the vault
- [ ] `/plan today|tomorrow` with Ollama integration
- [ ] Tag extraction / auto-tagging (`#tag`)
- [ ] Config file support (dotenv / JSON)
- [ ] Richer error messages and logging
- [ ] Unit tests for commands / parser / vault

## Phase 4: Desktop UI Foundation (P0)
- [ ] Install and configure shadcn/ui with dark theme (near-black)
- [ ] Add core components (Button, Card, Input, ScrollArea, Separator, Tabs)
- [ ] App shell layout with sidebar + resizable panes
- [ ] TanStack Router setup
- [ ] zustand state management for vault state and filters

## Phase 5: Vault Browser (P0)
- [ ] Sidebar with vault folders + note counts
- [ ] Note list pane (sorted by date, tags, preview)
- [ ] Note viewer with react-markdown + remark-gfm
- [ ] Vault scanning / indexing on load
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
