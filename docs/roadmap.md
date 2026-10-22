# Roadmap

Milestones are ordered; each maps to a phase in [`PLAN.md`](PLAN.md) and a section in
[`TODO.md`](TODO.md).

## M0 - Tooling & enforcement (Phase 0) ✅

oxlint + prettier, Husky hooks (pre-commit / commit-msg / pre-push), lint-staged and commitlint, the
`pnpm validate` gate, a single TypeScript version across the workspace, and the branch-based
workflow written down in [`RULES.md`](../RULES.md) with [`AGENTS.md`](../AGENTS.md) and
[`CLAUDE.md`](../CLAUDE.md) for agents. GitHub Actions runs the same gate on every PR into `main`
(`.github/workflows/validate.yml`), and branch protection on `main` requires that check before a pull
request can merge, so the gate is enforced rather than only reported.

## M1 - Tracking docs (Phase 1) ✅

The `PLAN.md` / `TODO.md` / `PROGRESS.md` / `FEATURES.md` / `ARCHITECTURE.md` set and the `docs/`
folder, so progress is always visible.

## M2 - Shared packages (Phase 2) ✅

- `@lumos/shared` - `Folder`, `NoteInput`, `Parsed`, `Frontmatter`, `Note`, `VaultEntry` types.
- `@lumos/vault-utils` - `slugify`, `makeTitle`, `parseNote`, `serializeNote`, `readNote`,
  `listNotes`, `getNotesByFolder`, `searchNotes`, `saveNote`.
- The daemon is refactored onto the shared packages, so the desktop can reuse the same logic.

## M3 - Daemon enhanced (Phase 3) — mostly done

- Link expansion for `/read` and `/interview` (title, description, image). ✅ (`GET /link`, and the desktop reads the page in place)
- Instagram and Facebook links play in place through their own embeds, with the caption card the daemon reads. ✅
- `/find <query>` over the vault. ✅ (title, tags and body; five matches per reply, the rest counted)
- `/plan today|tomorrow` backed by a local Ollama model.
- Tag extraction and auto-tagging. ✅ (`#hashtags` in a message become the note's frontmatter tags, using the graph's own rules)
- Settings from a config file, with the environment overriding it. ✅ (`lumos.config.json`, see [daemon.md](daemon.md))

## M4 - Dark UI foundation (Phase 4) — mostly done

- Dark tokens from [`design.md`](design.md) applied via Tailwind v4. ✅
- App shell with sidebar and panes. ✅ (the list column is resizable by drag, double-click or arrow keys)
- TanStack Router + zustand wired up. ⏳ (currently plain React state)

## M5 - Vault browser MVP (Phase 5) — in progress

- Folder sidebar, note list, note viewer. ✅
- Vault load on mount via the daemon read API. ✅
- Markdown rendering. ✅
- Link graph: notes and tags as nodes, links and tag references as edges, filters and local depth. ✅
- Tag filtering: the tags in the current folder and query become chips with counts, a chip or a note's own tag narrows the list, and a tag node offers **Show notes** with the same filter. ✅
- Backlinks in the note viewer: the notes that link to the open one, from the same graph, each one a button that opens it. ✅
- The graph keeps its layout: node positions and a view you placed survive a tab switch, and a resized
  pane re-fits a view the app fitted itself. ✅

That finishes the graph, code in a note is highlighted, and a scraped page is now kept for the
session. The phase itself is not finished: two link-pane items - less site chrome in the reader's
text, and reading a PDF or plain HTML file - are still open under **Plan** in
[`TODO.md`](TODO.md).

## M6 - Search (Phase 6) ✅

- Full-text search with `fuse.js`. ✅ (ranked over titles, tags and previews, and usable offline)
- `Cmd/Ctrl+K` search modal. ✅ (arrows, `Enter`, `Esc`; body matches come from `GET /notes/search`)
- Recent notes. ✅ (an empty palette lists what was opened this session; a reload starts empty)

## M7 - Editing + polish (Phases 7-8) — partly done

- Desktop component tests in jsdom with Testing Library: the sidebar, note list, palette and link
  pane. ✅
- Markdown editor with preview and save-to-disk.
- Bulk operations (move, tag, archive).
- List virtualization and a daemon-side search index.
- Subtle transitions between panes and panels.
- Screenshots in the docs, and a standalone `USAGE.md`.

The work itself is listed under **Plan** in [`TODO.md`](TODO.md).

## Beyond

Ideas not yet committed: link enrichment summaries, statistics/insights, and optional
sync/backups. These are recorded in [`FEATURES.md`](FEATURES.md) as `idea`. The graph view left this
list and shipped in M5, together with the backlinks panel and the tag nodes; what is left of it
sits under **Plan** in [`TODO.md`](TODO.md).
