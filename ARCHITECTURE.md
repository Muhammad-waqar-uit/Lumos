# Lumos - Architecture

## Overview

Lumos is a pnpm monorepo. Two applications share a common Markdown vault:

- **`apps/daemon`** - capture service. Connects to WhatsApp, parses messages, writes Markdown notes.
- **`apps/desktop`** - Tauri desktop UI. Browses, searches, and (later) edits the vault.
- **`packages/*`** - shared TypeScript: `@lumos/shared` (types) and `@lumos/vault-utils` (vault read/list/search/write).
- **`vault/`** - the user's notes as plain Markdown files (created at runtime, git-ignored).

## Component Diagram

```
WhatsApp ──► Daemon ──► vault/*.md ◄── Desktop (Tauri UI)
                │                          │
                └── HTTP API (:3001) ◄─────┘  (optional integration)
```

## Data Flow

1. A message arrives on the Lumos WhatsApp number.
2. The daemon checks the sender against `ALLOWED_NUMBERS`.
3. The message text is parsed into a command (`parseMessage`).
4. For note commands the vault writer creates a Markdown file with YAML frontmatter.
5. The daemon replies to the sender with a confirmation.
6. The desktop app reads the vault directory directly from disk and renders it.

## Daemon

- **Runtime**: Node.js + TypeScript, executed with `tsx`.
- **HTTP**: Fastify on `127.0.0.1:3001`.
- **WhatsApp**: Baileys multi-device; auth persists in `apps/daemon/auth_info/`.
- **Modules**:
  - `commands.ts` - parse command text into a typed result.
  - `vault.ts` - write notes to disk with frontmatter.
  - `handler.ts` - route a parsed command to a reply.
  - `server.ts` - Fastify routes + start WhatsApp.
  - `whatsapp.ts` - Baileys connection, allowlist, message handling.

## Desktop

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite/React frontend.
- **UI**: Tailwind CSS + shadcn/ui, dark minimal theme.
- **Access to the vault**: via Tauri commands / filesystem APIs (planned) and/or the daemon HTTP API.

## Vault

- Plain Markdown files with YAML frontmatter.
- Folders: `Inbox`, `Ideas`, `Interviews`, `Goals`, `Reading`.
- Filenames: `YYYY-MM-DD-slug.md`. See [docs/vault.md](docs/vault.md).

## UI Theme (Dark Minimal)

- Background near-black (`hsl(0 0% 3.9%)`).
- Subtle surfaces and thin, low-opacity borders.
- High-contrast text; restrained accent.
- No gradients, no heavy shadows. See [docs/design.md](docs/design.md).

## Tech Decisions

- **Local-first**: no cloud service is required for core functionality.
- **Portable vault**: files remain readable in Obsidian and any Markdown editor.
- **Daemon is standalone**: it can run headless with just the HTTP API.
- **Desktop is the primary UI** going forward; the HTTP API is an integration path, not the main one.

## Repository Layout

```
lumos/
├── apps/
│   ├── daemon/       # WhatsApp capture service
│   └── desktop/      # Tauri desktop UI
├── packages/         # @lumos/shared (types) + @lumos/vault-utils (vault ops)
├── docs/             # project documentation
├── idea/             # original idea PDFs and notes
├── vault/            # user notes (git-ignored)
├── PLAN.md TODO.md PROGRESS.md FEATURES.md ARCHITECTURE.md CONTRIBUTING.md CHANGELOG.md
└── README.md
```
