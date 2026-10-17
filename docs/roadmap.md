# Roadmap

Milestones are ordered; each maps to a phase in [`PLAN.md`](PLAN.md) and a section in
[`TODO.md`](TODO.md).

## M0 - Tooling & enforcement (Phase 0) ✅

oxlint + prettier, Husky hooks (pre-commit / commit-msg / pre-push), lint-staged and commitlint, the
`pnpm validate` gate, a single TypeScript version across the workspace, and the branch-based
workflow written down in [`RULES.md`](../RULES.md) with [`AGENTS.md`](../AGENTS.md) and
[`CLAUDE.md`](../CLAUDE.md) for agents. GitHub Actions runs the same gate on every PR into `main`
(`.github/workflows/validate.yml`). Remaining: branch protection on `main`, so the check is actually
required.

## M1 - Tracking docs (Phase 1) ✅

The `PLAN.md` / `TODO.md` / `PROGRESS.md` / `FEATURES.md` / `ARCHITECTURE.md` set and the `docs/`
folder, so progress is always visible.

## M2 - Shared packages (Phase 2) ✅

- `@lumos/shared` - `Folder`, `NoteInput`, `Parsed`, `Frontmatter`, `Note`, `VaultEntry` types.
- `@lumos/vault-utils` - `slugify`, `makeTitle`, `parseNote`, `serializeNote`, `readNote`,
  `listNotes`, `getNotesByFolder`, `searchNotes`, `saveNote`.
- The daemon is refactored onto the shared packages, so the desktop can reuse the same logic.

## M3 - Daemon enhanced (Phase 3)

- Link expansion for `/read` and `/interview` (title, description, image). ✅ (`GET /link`, and the desktop reads the page in place)
- Instagram and Facebook links play in place through their own embeds, with the caption card the daemon reads. ✅
- `/find <query>` over the vault. ✅ (title, tags and body; five matches per reply, the rest counted)
- `/plan today|tomorrow` backed by a local Ollama model.
- Tag extraction and auto-tagging. ✅ (`#hashtags` in a message become the note's frontmatter tags, using the graph's own rules)

## M4 - Dark UI foundation (Phase 4) — mostly done

- Dark tokens from [`design.md`](design.md) applied via Tailwind v4. ✅
- App shell with sidebar and panes. ✅ (resizable panes pending)
- TanStack Router + zustand wired up. ⏳ (currently plain React state)

## M5 - Vault browser MVP (Phase 5) — in progress

- Folder sidebar, note list, note viewer. ✅
- Vault load on mount via the daemon read API. ✅
- Markdown rendering. ✅
- Link graph: notes and tags as nodes, links and tag references as edges, filters and local depth. ✅
- Tag filtering. ⏳

## M6 - Search (Phase 6)

- Full-text search with `fuse.js`.
- `Cmd/Ctrl+K` search modal.
- Recent notes.

## M7 - Editing + polish (Phases 7-8)

- Markdown editor with preview and save-to-disk.
- Bulk operations (move, tag, archive).
- Performance, tests, and complete documentation with screenshots.

## Beyond

Ideas not yet committed: link enrichment summaries, statistics/insights, and optional
sync/backups. These are recorded in [`FEATURES.md`](FEATURES.md) as `idea`. The graph view left this
list and shipped in M5; what is left of it - a backlinks panel, tag nodes treated apart from notes -
lives in [`TODO.md`](TODO.md) Phase 5.
