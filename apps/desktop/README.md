# Lumos Desktop

The Lumos Desktop app is a Tauri-based desktop client for browsing, searching, and managing your Lumos second brain. Built with React, TypeScript, and Vite, it provides a polished interface to explore your vault of captured notes.

## Overview

While the daemon handles capture via WhatsApp, the desktop app is designed to help you:
- Browse notes organized by folders (Inbox, Ideas, Interviews, Goals, Reading)
- Search across your entire vault
- View notes with their Markdown rendered
- Play a link or read the page it points at without leaving the app — a YouTube or Vimeo link plays in place, an image link shows the image, any other page is read as text
- Tag and filter your knowledge base
- Get a bird's-eye view of your captured thoughts, as a link graph

Notes are read-only today, and the vault is served by the daemon: with it stopped the app shows
`src/lib/demo.ts` instead. Set `VITE_DAEMON_URL` to point the app at a daemon on another port. What is
known to be missing is listed in [docs/LIMITATIONS.md](../../docs/LIMITATIONS.md).

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

The desktop app reads from the same vault directory that the daemon writes to. By default, this is `../../vault` relative to the daemon, so the desktop app can access it directly from the filesystem.

## Roadmap

- [~] Vault browser with folder navigation (dark shell, folder sidebar, note list and viewer built)
- [ ] Full-text search
- [ ] Note editor with Markdown preview
- [ ] Tag management and filtering
- [x] Graph view (link graph from the daemon, canvas force layout, per-folder hues, filters, local depth)
- [x] Links in place (a YouTube or Vimeo link plays in the note viewer, an image link shows the image, any other page is scraped by the daemon and read as text)
- [ ] Link reader polish (session cache, less site chrome in the extracted text) — see [docs/LIMITATIONS.md](../../docs/LIMITATIONS.md)
- [ ] Daily notes view
- [ ] Statistics and insights

## Related

- [Root README](../../README.md) - Project overview
- [Daemon README](../daemon/README.md) - Capture engine documentation
- [RULES.md](../../RULES.md) - build, commit and branch rules (enforced by git hooks)
- [docs/desktop.md](../../docs/desktop.md) - desktop architecture and layout
- [Tauri Docs](https://tauri.app/) - Tauri framework documentation
