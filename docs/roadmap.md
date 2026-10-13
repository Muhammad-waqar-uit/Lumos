# Roadmap

Milestones are ordered; each maps to a phase in [`../PLAN.md`](../PLAN.md) and a section in
[`../TODO.md`](../TODO.md).

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
- `/find <query>` over the vault.
- `/plan today|tomorrow` backed by a local Ollama model.
- Tag extraction and auto-tagging.

## M4 - Dark UI foundation (Phase 4)

- shadcn/ui configured with the dark tokens in [`design.md`](design.md).
- App shell with sidebar and resizable panes.
- TanStack Router + zustand wired up.

## M5 - Vault browser MVP (Phase 5)

- Folder sidebar, note list, note viewer.
- Vault scanning and indexing on load.
- Tag filtering.

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
sync/backups, and a graph view. These are recorded in [`../FEATURES.md`](../FEATURES.md) as `idea`.
