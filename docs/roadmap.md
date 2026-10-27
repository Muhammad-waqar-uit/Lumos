# Roadmap

Milestones are ordered; each maps to a phase in [`PLAN.md`](PLAN.md) and a section in
[`TODO.md`](TODO.md).

## M0 - Tooling & enforcement (Phase 0) ✅

oxlint + prettier, Husky hooks (pre-commit / commit-msg / pre-push), lint-staged and commitlint, the
`pnpm validate` gate, a single TypeScript version across the workspace, and the workflow written
down in [`RULES.md`](../RULES.md) with [`AGENTS.md`](../AGENTS.md) and [`CLAUDE.md`](../CLAUDE.md)
for agents. GitHub Actions runs the same gate on every push to `main`
(`.github/workflows/validate.yml`), so a breakage is reported even when the local hook was skipped
by hand.

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
- `/plan today|tomorrow` backed by a local Ollama model. ✅ (the vault's 20 newest notes become the prompt; a missing Ollama or model answers with one sentence instead)
- Tag extraction and auto-tagging. ✅ (`#hashtags` in a message become the note's frontmatter tags, using the graph's own rules)
- Settings from a config file, with the environment overriding it. ✅ (`lumos.config.json`, see [daemon.md](daemon.md))
- The capture link, reported and controlled from the app. ✅ (`GET /whatsapp`, `POST
  /whatsapp/connect` and `/whatsapp/disconnect`; the status-bar chip and panel carry the state, the
  pairing code and when a message last arrived. Unlinking stays on the phone, which the app says)

## M4 - Dark UI foundation (Phase 4) — mostly done

- Dark tokens from [`design.md`](design.md) applied via Tailwind v4. ✅
- App shell with sidebar and panes. ✅ (the list column is resizable by drag, double-click or arrow keys)
- TanStack Router wired up. ✅ (the pane and the open note are address parameters, 2026-10-24)
- zustand wired up. ✅ (the vault index and the list's filters; the pane and the note stay in the address)

## M5 - Vault browser MVP (Phase 5) — in progress

- Folder sidebar, note list, note viewer. ✅
- Vault load on mount via the daemon read API. ✅
- Markdown rendering. ✅
- Link graph: notes and tags as nodes, links and tag references as edges, filters and local depth. ✅
- Tag filtering: the tags in the current folder and query become chips with counts, a chip or a note's own tag narrows the list, and a tag node offers **Show notes** with the same filter. ✅
- Backlinks in the note viewer: the notes that link to the open one, from the same graph, each one a button that opens it. ✅
- Vault insights: a **Stats** tab that counts what the vault holds and where it is thin - links,
  unresolved targets, notes added this week and this month, the most-linked notes, the notes nothing
  links to, the commonest tags, every folder's size - with each row opening a note or filtering the
  list. Computed from the listing and the graph the app already has, so it costs no request. ✅
  (`src/lib/insights.ts`, `InsightsView.tsx`)
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
- Commands in the palette. ✅ (new note, new folder named in the palette itself, the graph and the
  trash; an empty field lists them under the recent notes, a matched query puts them first)

## M7 - Editing + polish (Phases 7-8) — partly done

- Desktop component tests in jsdom with Testing Library: the sidebar, note list, palette, link pane
  and note editor. ✅
- Editing a note's body in the app and saving it to disk. ✅ (the frontmatter is left as written;
  there is no preview beside the textarea)
- Creating a note from the app. ✅ (a composer in the list's own pane: a folder picker and a
  textarea, filed with the same writer WhatsApp uses, stamped `source: desktop`)
- Renaming, moving and deleting a note from the app. ✅ (a title-based rename that keeps the filename,
  the first heading and the links pointing here in step, a move that keeps the filename, and a delete
  that asks first; an undo is still open)
- A preflight the browser actually sends. ✅ (found while exercising the editor: the CORS default
  omitted `PUT`, so `curl` could save while the app could not)
- Bulk operations (move, tag, archive). ✅ (checkboxes in the list, a bulk bar, refusals never abandon the rest)
- List virtualization and a daemon-side search index. ✅ (above 50 notes the list windows itself;
  the daemon answers `/notes/search` from a body index instead of re-reading the vault)
- Subtle transitions between panes and panels. ✅ (one fade or slide per entrance, none of it for
  `prefers-reduced-motion`)
- Screenshots in the docs, and a standalone `USAGE.md`. ✅ (`docs/images/`, and a root `USAGE.md`
  that covers capture, the desktop app, the API, settings and troubleshooting)

The work itself is listed under **Plan** in [`TODO.md`](TODO.md).

## M8 - Agent access (Phase 9) ✅

- An MCP server over the vault, on stdio, so Claude Code and other agents work on the notes rather
  than on a copy of them. ✅ (`apps/mcp`: twelve tools, `LUMOS_VAULT` to choose the vault, the
  operations through `@lumos/vault-utils` so there is no second writer; see [mcp.md](mcp.md))
- Connecting a client documented end to end, for Claude Code and Claude Desktop. ✅ (the commands,
  the JSON config, the tool list and the trade-offs are in [mcp.md](mcp.md))

What is left in this milestone is a person's check rather than code: signing the server into a real
Claude Code session and letting an agent choose the tools itself. It is under **Needs your
testing** in [`TODO.md`](TODO.md).

## M9 - Explainers (Phase 10) — planned, nothing built

Steppable explanations of how Lumos works, drawn from one scene that produces SVG frames for a
person and a per-step text form for an agent. The line between the two is the point: the project
explains itself twice today - prose and screenshots for a human, tool descriptions for a model - and
this is the first thing that could explain both from one source.

- Docs explainers, rendered at build time into committed SVG frames. **First slice**, because
  nothing enters an app bundle: the engine is paid at build time, not on every launch.
- An "Explain" panel in the app for a note or a graph cluster - the story of why these notes are
  connected, one step at a time. Gated on the spike: it would put a second rendering model beside
  the canvas force graph.
- The vault format taken apart (`2026-10-26-plan-the-week.md` → date, slug, extension, frontmatter),
  taught where people get it wrong.

The engine under consideration is [lantern](https://github.com/ivarvong/lantern) - MIT, zero runtime
dependencies, a port of manim's core - which is not on npm, so it would arrive as a pinned
dependency or a vendored copy. What is deliberately **out** of scope is what lantern was built for:
animated before/after explainers of a code change. Lumos stores notes, not history, and there is no
diff to explain. The full shape, the cost and the one-afternoon spike that decides it are in
[explainers.md](explainers.md); the work is under Phase 10 in [`TODO.md`](TODO.md).

## Beyond

Ideas not yet committed: link enrichment summaries and optional sync/backups. Statistics left this
list on 2026-10-27 and shipped as the **Stats** tab. These are recorded in [`FEATURES.md`](FEATURES.md) as `idea`. The graph view left this
list and shipped in M5, together with the backlinks panel and the tag nodes; what is left of it
sits under **Plan** in [`TODO.md`](TODO.md).
