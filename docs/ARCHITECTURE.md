# Lumos - Architecture

## Overview

Lumos is a pnpm monorepo. Two applications share a common Markdown vault:

- **`apps/daemon`** - capture service. Connects to WhatsApp, parses messages, writes Markdown notes.
- **`apps/desktop`** - Tauri desktop UI. Browses, searches, and (later) edits the vault.
- **`packages/*`** - shared TypeScript: `@lumos/shared` (types) and `@lumos/vault-utils` (vault read/list/search/write, link/tag extraction, graph building, and link classification plus page metadata on browser-safe subpaths).
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
6. The desktop app requests the vault from the daemon read API (`/notes`, `/folders`, `/note`, `/graph`) and renders it (demo data when the daemon is offline).
7. For a note that carries a link, the desktop asks the daemon to fetch it (`/link`) and renders what comes back: a player for a video, the image itself, or the page's text and metadata. A video or an image is classified locally, so it never needs the request at all.

## Daemon

- **Runtime**: Node.js + TypeScript, executed with `tsx`.
- **HTTP**: Fastify on `127.0.0.1:3001`.
- **WhatsApp**: Baileys multi-device; auth persists in `apps/daemon/auth_info/`.
- **Modules**:
  - `commands.ts` - parse command text into a typed result.
  - `vault.ts` - resolve the vault path from `VAULT_PATH`.
  - `handler.ts` - route a parsed command to a reply; the vault directory arrives as an argument.
  - `app.ts` - `createApp()`, which builds the Fastify app (CORS + routes) over a given vault, so the routes can be tested without binding a port.
  - `server.ts` - entry point: build the app, listen on loopback, start WhatsApp.
  - `fetch-link.ts` - fetch one link for the desktop, with the guards and caps `GET /link` returns as refusals.
  - `whatsapp.ts` - Baileys connection, allowlist, message handling.

Tests sit beside the modules they cover (`commands.test.ts`, `handler.test.ts`, `app.test.ts`,
`fetch-link.test.ts`). Each passes a fresh temporary directory in as the vault, so the real vault is
never read or written; the route tests drive the app through `app.inject()` with the link fetcher
injected, so no port is bound and no network request is made.

## Desktop

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite/React frontend.
- **UI**: Tailwind CSS + shadcn/ui, dark minimal theme.
- **Access to the vault**: the daemon HTTP read API today; Tauri filesystem commands are a possible future path so it can run without the daemon.
- **Panes**: the notes list + viewer, or the link graph, sharing the folder sidebar. The graph renderer loads lazily with its tab, so the notes path stays light.
- **Link pane**: a note's link is shown in the viewer - a player, an image, or the scraped page - instead of only linking out. It reads through `src/lib/api.ts` like every other pane and has its own loading, error and retry states.

## Vault

- Plain Markdown files with YAML frontmatter.
- Folders: `Inbox`, `Ideas`, `Interviews`, `Goals`, `Reading`.
- Filenames: `YYYY-MM-DD-slug.md`. See [vault.md](vault.md).

## UI Theme (Dark Minimal)

- Background near-black (`hsl(0 0% 3.9%)`).
- Subtle surfaces and thin, low-opacity borders.
- High-contrast text; restrained accent.
- No gradients, no heavy shadows. See [design.md](design.md).

## Tech Decisions

- **Local-first**: no cloud service is required for core functionality.
- **Portable vault**: files remain readable in Obsidian and any Markdown editor.
- **Daemon is standalone**: it can run headless with just the HTTP API.
- **Desktop is the primary UI** going forward; the HTTP API is an integration path, not the main one.

## Tests

- **Runner**: vitest, run by `pnpm test` from the root (every workspace that has a suite).
- **Location**: `*.test.ts` next to the module it covers - no separate `tests/` tree.
- **Coverage today**: `@lumos/vault-utils` (slugify, frontmatter parsing, save/read/list/search, link and tag extraction, graph assembly and neighbourhoods, the link classifier's URL shapes and page metadata) and the daemon (the parser, the filing path, the link fetcher's guards and caps, and every HTTP route driven through `app.inject()` without binding a port). The desktop UI is still uncovered - it needs jsdom and Testing Library, tracked in [`TODO.md`](TODO.md).
- The suites run inside `pnpm validate`, so a failing test blocks a push exactly like a failing build.

## Repository Layout

```
lumos/
├── apps/
│   ├── daemon/       # WhatsApp capture service
│   └── desktop/      # Tauri desktop UI
├── packages/         # @lumos/shared (types) + @lumos/vault-utils (vault ops)
├── docs/             # plan + tracking + reference docs
│   ├── PLAN.md TODO.md PROGRESS.md FEATURES.md ARCHITECTURE.md LIMITATIONS.md
│   └── daemon.md desktop.md vault.md design.md roadmap.md
├── idea/             # original idea PDFs and notes
├── vault/            # user notes (git-ignored)
├── .husky/           # git hooks: pre-commit, commit-msg, pre-push
├── RULES.md AGENTS.md CLAUDE.md          # standards + agent working agreements
├── .oxlintrc.json .prettierrc.json .lintstagedrc.json commitlint.config.cjs
├── CHANGELOG.md CONTRIBUTING.md LICENSE
└── README.md
```

## Tooling & Enforcement

- **pnpm only** (pnpm workspace, `pnpm-lock.yaml` committed).
- **Lint:** oxlint, kept in step with the TypeScript version. **Format:** prettier.
- **Husky hooks** — `pre-commit` refuses to commit while on `main`, then runs lint-staged on the
  staged files; `commit-msg` runs commitlint; `pre-push` runs `pnpm validate`
  (lint + format:check + typecheck + test + build). None of the hooks can be bypassed.
- **One TypeScript version** (`~6.0.3`) across all four workspaces, each with a `typecheck` script.
- **Workflow:** every change lives on a short-lived `<type>/<short-description>` branch and lands in
  `main` through a pull request (squash-merge). `main` is always releasable. See [RULES.md §6](../RULES.md).
- **CI:** `.github/workflows/validate.yml` runs `pnpm validate` on every PR into `main` and every push
  to `main`. It calls the same `validate` script the hooks do, reads pnpm's version from the
  `packageManager` field, and caches the pnpm store against `pnpm-lock.yaml`. Branch protection is not
  enabled yet, so the check is not yet required to merge.
