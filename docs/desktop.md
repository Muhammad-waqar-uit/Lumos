# Desktop

The desktop app is the viewing half of Lumos: a Tauri desktop shell around a React UI that browses
the Markdown vault. It lives in [`apps/desktop`](../apps/desktop).

## Status

Currently the Tauri + React + TypeScript scaffold. The vault browser, note viewer, and search UI
are planned (see [`../TODO.md`](../TODO.md) Phases 4-7).

## Planned structure

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite + React frontend.
- **UI**: Tailwind CSS + shadcn/ui, dark minimal theme (see [`design.md`](design.md)).
- **Routing**: TanStack Router.
- **State**: zustand stores for the vault index, current folder, current note, and filters.
- **Rendering**: `react-markdown` + `remark-gfm` for notes; `fuse.js` for search; `lucide-react` for icons.

## Layout

A resizable three-pane shell:

```
┌───────────┬────────────────────┬────────────────────────────┐
│ Sidebar   │ Notes list         │ Note viewer                │
│ (folders) │ (sorted by date)   │ (Markdown rendered)        │
└───────────┴────────────────────┴────────────────────────────┘
```

## Access to the vault

The desktop reads the vault directory from disk. Two paths are possible:

1. **Tauri filesystem/Rust commands** - read and parse Markdown directly (preferred, no server needed).
2. **Daemon HTTP API** - reuse the daemon for parsing/writing when it is running.

Both are kept possible by putting shared logic in `packages/` (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md)).

## Keyboard

- `Cmd/Ctrl+K` - open the search modal.
- Arrow keys / `j` `k` - move through the note list.
- `Esc` - close overlays.

## Planned capabilities

- Folder sidebar with note counts.
- Note list with date, tags, and a text preview.
- Note viewer with frontmatter metadata and syntax-highlighted code.
- Full-text search across titles, content, and tags.
- Markdown editor with live preview and save-to-disk.
