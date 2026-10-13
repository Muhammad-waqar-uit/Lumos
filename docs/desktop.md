# Desktop

The desktop app is the viewing half of Lumos: a Tauri desktop shell around a React UI that browses
the Markdown vault. It lives in [`apps/desktop`](../apps/desktop).

## Status

The dark shell is built. The app renders a three-pane layout and loads the vault from the running
daemon (falling back to demo data when the daemon is offline):

- `src/App.tsx` - state, vault loading, folder + search filtering, selection
- `src/components/Sidebar.tsx` - folders with note counts
- `src/components/NoteList.tsx` - searchable note list (title, date, preview, tags)
- `src/components/NoteViewer.tsx` - note header (folder, date, source, url) + Markdown body
- `src/components/StatusBar.tsx` - connection state + note count
- `src/lib/api.ts` - daemon client (`/notes`, `/notes/search`, `/folders`, `/note`)
- `src/lib/demo.ts` - demo data used when the daemon is not running
- `src/index.css` - Tailwind v4 import + dark design tokens + `.markdown` typography for notes

### Markdown rendering

Note bodies render with `react-markdown` + `remark-gfm`, so headings, nested and ordered lists,
tables, task lists, blockquotes, fenced code and links all render instead of showing raw syntax.
Links are overridden to open with `target="_blank"` and `rel="noreferrer"` so a click cannot
navigate the app window away from the vault.

Styling lives in the `.markdown` rules in `src/index.css` and uses the existing theme tokens, so no
colour is hardcoded in a component. Fenced code blocks are styled but not yet syntax-highlighted.

Still to come: tag filtering, code syntax highlighting, resizable panes, routing, and a note editor
(see [`TODO.md`](TODO.md) Phases 4-7).

## Planned structure

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite + React frontend.
- **UI**: Tailwind CSS + shadcn/ui, dark minimal theme (see [`design.md`](design.md)).
- **Routing**: TanStack Router.
- **State**: zustand stores for the vault index, current folder, current note, and filters.
- **Rendering**: `react-markdown` + `remark-gfm` for notes (in use); `fuse.js` for search and
  `lucide-react` for icons (planned).

## Layout

A resizable three-pane shell:

```
┌───────────┬────────────────────┬────────────────────────────┐
│ Sidebar   │ Notes list         │ Note viewer                │
│ (folders) │ (sorted by date)   │ (Markdown rendered)        │
└───────────┴────────────────────┴────────────────────────────┘
```

## Access to the vault

The desktop currently reads the vault through the **daemon HTTP API** (which uses
`@lumos/vault-utils`, so parsing stays in one place). Set `VITE_DAEMON_URL` to point elsewhere;
it defaults to `http://127.0.0.1:3001`.

A future path is **Tauri filesystem/Rust commands** to read and parse Markdown directly, so the
app works without the daemon running. Both are kept possible by keeping logic in `packages/`
(see [`ARCHITECTURE.md`](ARCHITECTURE.md)).

## Keyboard

- `Cmd/Ctrl+K` - open the search modal.
- Arrow keys / `j` `k` - move through the note list.
- `Esc` - close overlays.

## Planned capabilities

- Folder sidebar with note counts.
- Note list with date, tags, and a text preview.
- Note viewer with frontmatter metadata (done) and syntax-highlighted code (planned).
- Full-text search across titles, content, and tags.
- Markdown editor with live preview and save-to-disk.
