# Lumos Desktop

The Lumos Desktop app is a Tauri-based desktop client for browsing, searching, and managing your Lumos second brain. Built with React, TypeScript, and Vite, it provides a polished interface to explore your vault of captured notes.

## Overview

While the daemon handles capture via WhatsApp, the desktop app is designed to help you:
- Browse notes organized by folders (Inbox, Ideas, Interviews, Goals, Reading)
- Search the vault from the keyboard: `Cmd/Ctrl+K` opens a palette that ranks titles, tags and previews with `fuse.js`, and adds the daemon's body matches when it is running (those rows are marked "in the body"); with nothing typed it lists the notes you opened this session
- View notes with their Markdown rendered, including syntax-highlighted code in a fence that names its language
- Play a link or read the page it points at without leaving the app — a YouTube or Vimeo link plays in place, an Instagram reel or post and a Facebook video or post render through the host's own embed with their caption beside them, an image link shows the image, any other page is read as text
- Filter by folder, by text, and by tag — the tags in scope appear as chips with counts, and a note's own tag works the same way
- Get a bird's-eye view of your captured thoughts, as a link graph
- Edit a note and save it back to the vault — **Edit** in the note header, Save (`Cmd/Ctrl+S`) or
  Cancel (`Esc`). Only the body is written; the frontmatter block is left exactly as the file has it
  so a hand-edited block is never quietly rewritten. Saving needs the daemon

The vault is served by the daemon: with it stopped the app shows `src/lib/demo.ts` instead and Edit
is disabled. Set `VITE_DAEMON_URL` to point the app at a daemon on another port. What is known to be
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

- [~] Vault browser with folder navigation (dark shell, folder sidebar, note list and viewer built)
- [x] Full-text search (`Cmd/Ctrl+K` palette: `fuse.js` ranking over titles, tags and previews, plus the daemon's body matches)
- [ ] Note editor with Markdown preview
- [x] Tag filtering (chips with counts, a note's own tag as a filter, tag nodes offering **Show notes**); bulk tag management is still to come
- [x] Graph view (link graph from the daemon, canvas force layout, per-folder hues, filters, local depth)
- [x] Syntax-highlighted code blocks (37 common languages; only a fence that names one is highlighted)
- [x] Recent notes in the palette (the five opened this session, newest first)
- [x] Resizable list column (drag the separator, double-click to reset, or use the arrow keys)
- [x] Frontmatter warnings (a note with a broken frontmatter block is still listed and readable, with the reasons above its body and a marker in the list)
- [x] Links in place (a YouTube or Vimeo link plays in the note viewer, an Instagram reel/post and a Facebook video/post render through their own embeds with the caption the daemon reads, an image link shows the image, any other page is scraped and read as text, and a scraped page is kept for the session)
- [ ] Link reader polish (less site chrome in the extracted text) — see [docs/LIMITATIONS.md](../../docs/LIMITATIONS.md)
- [ ] Daily notes view
- [ ] Statistics and insights

## Related

- [Root README](../../README.md) - Project overview
- [Daemon README](../daemon/README.md) - Capture engine documentation
- [RULES.md](../../RULES.md) - build, commit and branch rules (enforced by git hooks)
- [docs/desktop.md](../../docs/desktop.md) - desktop architecture and layout
- [Tauri Docs](https://tauri.app/) - Tauri framework documentation
