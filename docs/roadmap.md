# Roadmap

Milestones are ordered; each maps to a phase in [`PLAN.md`](PLAN.md) and a section in
[`TODO.md`](TODO.md).

## M0 - Tooling & enforcement (Phase 0) ✅

oxlint + prettier, Husky hooks (pre-commit / commit-msg / pre-push), lint-staged and commitlint, the
`pnpm validate` gate, a single TypeScript version across the workspace, and the branch-based
workflow written down in [`RULES.md`](../RULES.md) with [`AGENTS.md`](../AGENTS.md) and
[`CLAUDE.md`](../CLAUDE.md) for agents. Remaining: GitHub Actions running `pnpm validate` on every
PR, plus branch protection on `main`.

## M1 - Tracking docs (Phase 1) ✅

The `PLAN.md` / `TODO.md` / `PROGRESS.md` / `FEATURES.md` / `ARCHITECTURE.md` set and the `docs/`
folder, so progress is always visible.

## M2 - Shared packages (Phase 2) ✅

- `@lumos/shared` - `Folder`, `NoteInput`, `Parsed`, `Frontmatter`, `Note`, `VaultEntry` types.
- `@lumos/vault-utils` - `slugify`, `makeTitle`, `parseNote`, `serializeNote`, `readNote`,
  `listNotes`, `getNotesByFolder`, `searchNotes`, `saveNote`.
- The daemon is refactored onto the shared packages, so the desktop can reuse the same logic.

## M3 - Daemon enhanced (Phase 3)

- Link expansion for `/read` and `/interview` (title, description, image).
- `/find <query>` over the vault. ✅ (title, tags and body; five matches per reply, the rest counted)
- `/plan today|tomorrow` backed by a local Ollama model.
- Tag extraction and auto-tagging.

## M4 - Dark UI foundation (Phase 4) — mostly done

- Dark tokens from [`design.md`](design.md) applied via Tailwind v4. ✅
- App shell with sidebar and panes. ✅ (resizable panes pending)
- TanStack Router + zustand wired up. ⏳ (currently plain React state)

## M5 - Vault browser MVP (Phase 5) — in progress

- Folder sidebar, note list, note viewer. ✅
- Vault load on mount via the daemon read API. ✅
- Markdown rendering and tag filtering. ⏳

## M6 - Search (Phase 6)

- Full-text search with `fuse.js`.
- `Cmd/Ctrl+K` search modal.
- Recent notes.

## M7 - Editing + polish (Phases 7-8)

- Markdown editor with preview and save-to-disk.
- Bulk operations (move, tag, archive).
- Performance, tests, and complete documentation with screenshots.

## Beyond

Ideas not yet committed: link enrichment summaries, statistics/insights, optional
sync/backups, and a graph view. These are recorded in [`FEATURES.md`](FEATURES.md) as `idea`.
