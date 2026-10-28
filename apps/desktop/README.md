<img src="../../assets/lumos-mark.svg" alt="Lumos" width="56" />

# Lumos Desktop

The Lumos Desktop app is a Tauri-based desktop client for browsing, searching, and managing your Lumos second brain. Built with React, TypeScript, and Vite, it provides a polished interface to explore your vault of captured notes.

## Overview

In the running app, `Cmd/Ctrl+K` works even in a focused field, the status-bar Moon/Sun button changes the full palette, and Lumos opens its pairing QR panel automatically when a new device needs to scan.

While the daemon handles capture via WhatsApp, the desktop app is designed to help you:
- Browse notes organized by folders (Inbox, Ideas, Interviews, Goals, Reading)
- Search the vault from the keyboard: `Cmd/Ctrl+K` opens a palette from anywhere, including while a field has focus; it ranks titles, tags and previews with `fuse.js`, and adds the daemon's body matches when it is running (those rows are marked "in the body"). With nothing typed it lists recent notes and the palette's commands
- Switch the whole app between dark and light palettes with the Moon/Sun control; the choice persists on this device
- See the WhatsApp link and act on it: the chip at the right of the status bar names the link's state (`WhatsApp linked`, `Pair WhatsApp`, `WhatsApp unlinked`, `WhatsApp off`) and opens the in-app panel; the shell opens it automatically when the pairing code first arrives. It shows the pairing code and offers **Connect**/**Disconnect** — disconnecting keeps the phone linked, so connecting again needs no code
- See a capture arrive: a note written by WhatsApp while the window is open shows up within one poll, with a status-bar notice naming it and an **Open** button (or a count and **Open newest** when several land together)
- View notes with their Markdown rendered, including syntax-highlighted code in a fence that names its language
- Play a link or read the page it points at without leaving the app — a YouTube or Vimeo link plays in place, an Instagram reel or post and a Facebook video or post render through the host's own embed with their caption beside them, an image link shows the image, any other page is read as text
- Edit the open note's tags and status in the strip under its header — remove a chip, type a tag, pick a status; a tag is written the way the graph reads it, and the list, folder counts and graph are re-read after a change
- Filter by folder, by text, and by tag — the tags in scope appear as chips with counts, and a note's own tag works the same way
- Get a bird's-eye view of your captured thoughts, as a link graph
- Edit a note and save it back to the vault — **Edit** in the note header, Save (`Cmd/Ctrl+S`) or
  Cancel (`Esc`). Only the body is written; the frontmatter block is left exactly as the file has it
  so a hand-edited block is never quietly rewritten. Saving needs the daemon
- Change the file itself — the **...** button opens **Rename**, **Move** and **Delete**. A rename
  takes a title, renames both the file (keeping its date prefix) and the body's first heading, and
  rewrites the links in other notes that pointed at the old title so the backlinks survive; a move
  changes the folder and keeps the filename; a delete asks first, moves the file to the vault's
  `.trash`, and leaves **Undo** in the status bar
- The **Stats** tab counts the vault and shows where it is thin: links and the targets that do not
  exist yet, notes added this week, the notes with the most links pointing in, the ones with no
  links or tags, the commonest tags and every folder's size. Each row opens a note or filters the
  list, and it is counted from the listing and graph the window already has, so it works offline
- The **Trash** tab beside Notes, Graph and Stats lists what those deletes kept — each entry with
  its folder and when it went — with a **Restore** per note and an **Empty the trash** that asks
  first, because emptying is the one action in the app with nothing to undo afterwards

The vault is served by the daemon: with it stopped the app shows `src/lib/demo.ts` instead and
editing, renaming, moving and deleting are disabled. Set `VITE_DAEMON_URL` to point the app at a daemon on another port. What is known to be
missing is listed in [docs/LIMITATIONS.md](../../docs/LIMITATIONS.md).

## Tech Stack

- **Framework**: [Tauri](https://tauri.app/) - Rust-based desktop app framework
- **Frontend**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) for fast HMR and optimized builds
- **UI**: Modern React components with TypeScript

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- [Rust](https://rustup.rs/) (for Tauri)
- Platform-specific dependencies for Tauri - see [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Getting Started

```bash
# From the monorepo root
pnpm install

# Start the Vite dev server (fastest loop, port 1420)
pnpm --filter desktop dev

# In a separate terminal, start the full Tauri window
pnpm --filter desktop tauri dev
```

This will open the desktop app in development mode with hot reload.

### Building

```bash
# Build for production
cd apps/desktop
pnpm tauri build
```

Build artifacts will be available in `src-tauri/target/release/bundle/`.

## Project Structure

```
apps/desktop/
├── src/           # React frontend source
├── src-tauri/     # Tauri Rust backend
├── public/        # Static assets
└── index.html     # Entry point
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Integration with Lumos

The desktop app does **not** read the vault directory itself. It reads through the daemon's HTTP API,
which points at the same `../../vault` directory the daemon writes to — there is no `invoke` call and
no filesystem plugin in `src/`, so every read goes through `src/lib/api.ts` and, with the daemon
stopped, the app falls back to `src/lib/demo.ts`. Reading the vault directly over Tauri commands is a
possible future path (see [docs/desktop.md](../../docs/desktop.md)); it does not exist today.

## Roadmap

- [~] Vault browser with folder navigation (dark-first shell with a light theme, folder sidebar, note list and viewer built)
- [x] Full-text search (`Cmd/Ctrl+K` palette: `fuse.js` ranking over titles, tags and previews, plus the daemon's body matches)
- [~] Note editor (the body is edited as text and saved back to the vault, and a new note can be written from the list; a live Markdown preview beside the textarea is still to come)
- [x] Tag filtering (chips with counts, a note's own tag as a filter, tag nodes offering **Show notes**); bulk tag management is still to come
- [x] Graph view (link graph from the daemon, canvas force layout, per-folder hues, filters, local depth)
- [x] Syntax-highlighted code blocks (37 common languages; only a fence that names one is highlighted)
- [x] Recent notes in the palette (the five opened this session, newest first)
- [x] Commands in the palette (new note, new folder named in the palette itself, and the graph, stats, trash and profile panes; Ctrl/Cmd+K is handled by the shell, including when a field has focus)
- [x] The WhatsApp link in the app (state, pairing code, connect and disconnect from the status bar chip; automatically opens the in-app pairing dialog when a QR arrives)
- [x] Resizable list column (drag the separator, double-click to reset, or use the arrow keys)
- [x] Frontmatter warnings (a note with a broken frontmatter block is still listed and readable, with the reasons above its body and a marker in the list)
- [x] Links in place (a YouTube or Vimeo link plays in the note viewer, an Instagram reel/post and a Facebook video/post render through their own embeds with the caption the daemon reads, an image link shows the image, any other page is scraped and read as text, and a scraped page is kept for the session)
- [ ] Link reader polish (less site chrome in the extracted text) — see [docs/LIMITATIONS.md](../../docs/LIMITATIONS.md)
- [ ] Daily notes view
- [x] Statistics and insights

## Related

- [Root README](../../README.md) - Project overview
- [Daemon README](../daemon/README.md) - Capture engine documentation
- [RULES.md](../../RULES.md) - build, commit and branch rules (enforced by git hooks)
- [docs/desktop.md](../../docs/desktop.md) - desktop architecture and layout
- [Tauri Docs](https://tauri.app/) - Tauri framework documentation
