# Lumos - Architecture

## Overview

Lumos is a pnpm monorepo. Three programs share a common Markdown vault:

- **`apps/daemon`** - capture service. Connects to WhatsApp, parses messages, writes Markdown notes.
- **`apps/desktop`** - Tauri desktop UI. Browses, searches, and (later) edits the vault.
- **`apps/mcp`** - MCP server over the same vault, on stdio, for Claude Code and other agents.
- **`packages/*`** - shared TypeScript: `@lumos/shared` (types) and `@lumos/vault-utils` (vault read/list/search/write, rename/move/delete, trash listing and emptying, link/tag extraction, graph building, and link classification plus page metadata on browser-safe subpaths).
- **`vault/`** - the user's notes as plain Markdown files (created at runtime, git-ignored).

## Component Diagram

```
WhatsApp ──► Daemon ──► vault/*.md ◄── Desktop (Tauri UI)
                │                          │
                │                          └── HTTP API (:3001), when the daemon is up
                │
                └── MCP server (stdio) ◄── Claude Code / any MCP client
                        │
                        └── reads and writes vault/*.md through @lumos/vault-utils
```

## Data Flow

1. A message arrives on the Lumos WhatsApp number.
2. The daemon checks the sender against `ALLOWED_NUMBERS`.
3. The message text is parsed into a command (`parseMessage`), against the folders the vault has - there is no fixed command table, so a folder made a moment ago is already a command. A bare `/` comes back as the menu rather than as an unknown command.
4. For note commands the vault writer creates a Markdown file with YAML frontmatter.
5. The daemon replies to the sender with a confirmation.
6. The desktop app requests the vault from the daemon read API (`/notes`, `/folders`, `/note`, `/graph`) and renders it (demo data when the daemon is offline).
7. For a note that carries a link, the desktop asks the daemon to fetch it (`/link`) and renders what comes back: a player for a video, the image itself, or the page's text and metadata. A video or an image is classified locally, so it never needs the request at all.
8. Editing runs the other way: the view sends a new body to `PUT /note`, the daemon writes it with `updateNote()` and answers the note as it now reads, and the app re-reads the listing, the folder counts and the graph because a new heading, a new tag or a new link changes all three. The frontmatter block is not touched - the body is replaced inside the file, not the note re-serialized.
9. Creating runs the same way with a different route: the composer posts a folder and text to `POST /notes`, the daemon runs it through the capture writer (`saveNote()`, stamped `source: desktop`) and answers the new note's key, and the app re-reads the same three views and opens what came back. There is no second write path - a note typed here is written exactly as a note captured on a phone would be.
10. The file itself can change too: `PATCH /note` renames a note to a new title (the file and the body's first heading both follow, through `renameNote()`), `POST /note/move` moves it to another folder under the name it has (`moveNote()`), and `DELETE /note` moves it to the trash (`deleteNote()`, answered as the entry an undo needs). Each answers the note as it now reads; a name another note holds is a `409` rather than a replacement, and every path is checked against the vault root before a file is read, moved or removed. The trash is then its own pair: `GET /trash` lists those entries newest first and `DELETE /trash` removes every one, through `listTrash()` and `emptyTrash()`. Emptying is the one command with no undo, so it is deliberately not parameterised for a single entry - restoring is how one note leaves - and an entry whose note cannot be read is skipped rather than failing the whole listing. A rename also carries the links that pointed at the note: `linkResolver()` and `rewriteLinks()` from `@lumos/vault-utils/graph` find what each target resolves to before and after the rename and rewrite only the targets it strands, so the backlinks survive, and the route answers the edited files as `updated`. The app re-reads the listing, the counts and the graph afterwards, because a rename is a new key, a new heading and new link text.

11. An agent reaches the same files a fourth way: the MCP client launches `apps/mcp`, and each tool call runs one `@lumos/vault-utils` function over the vault the server resolved at startup. Nothing is exported and nothing is indexed twice, so an edit from the app, Obsidian or an agent is what the next read of any of them sees. A note an agent creates is stamped `source: mcp`, the one thing that differs from a captured note.

## Daemon

- **Runtime**: Node.js + TypeScript, executed with `tsx`.
- **HTTP**: Fastify on `127.0.0.1:3001`.
- **WhatsApp**: Baileys multi-device; auth persists in `apps/daemon/auth_info/`.
- **Modules**:
  - `commands.ts` - parse command text into a typed result.
  - `config.ts` - read `lumos.config.json` and the environment into one `Config`, refusing a setting it cannot use.
  - `handler.ts` - route a parsed command to a reply; the vault directory arrives as an argument.
  - `app.ts` - `createApp()`, which builds the Fastify app (CORS + routes) over a given vault, so the routes can be tested without binding a port.
  - `server.ts` - entry point: build the app, listen on loopback, then start the WhatsApp bridge and hand it to the routes.
  - `fetch-link.ts` - fetch one link for the desktop, with the guards and caps `GET /link` returns as refusals; a PDF response is handed to
  - `read-pdf.ts` - the daemon's one parser dependency: a PDF's bytes become the same readable text a page produces (`unpdf`), or a refusal with a fixed sentence
  - `whatsapp.ts` - `createWhatsAppBridge()`: the Baileys connection, allowlist and message loop, as a controller the routes can report on, start and stop.
  - `bridge.ts` - the link's state (off, starting, waiting, connected, disconnected, logged out, error) shared between the socket and the routes. State only: no socket, no timers.
  - `qr.ts` - the pairing code between the socket and `GET /qrcode`, and its half-block rendering for the page and the app's panel.

Tests sit beside the modules they cover (`commands.test.ts`, `handler.test.ts`, `app.test.ts`,
`fetch-link.test.ts`). Each passes a fresh temporary directory in as the vault, so the real vault is
never read or written; the route tests drive the app through `app.inject()` with the link fetcher
injected, so no port is bound and no network request is made.

## Desktop

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite/React frontend.
- **UI**: Tailwind CSS + shadcn/ui, dark minimal theme.
- **Access to the vault**: the daemon HTTP API today - the read routes plus `POST /folders`, `PATCH /folder`, `DELETE /folder`, `PUT /note`, `POST /notes`, `PATCH /note`, `POST /note/move` and `DELETE /note` to write; `GET /whatsapp` and `POST /whatsapp/connect`/`disconnect` are how it reports and drives the capture link, which lives in the daemon's process and nowhere else; Tauri filesystem commands are a possible future path so it can run without the daemon. Folders are read, never assumed: the sidebar, the composer, both move menus and the graph legend all draw from one `GET /folders` list held in the store.
- **Panes**: the notes list + viewer, or the link graph, sharing the folder sidebar. The list column is resizable through `PaneSplitter`, and the width lives in the shell rather than in the pane. The graph renderer loads lazily with its tab, so the notes path stays light.
- **Link pane**: a note's link is shown in the viewer - a player, an image, or the scraped page - instead of only linking out. It reads through `src/lib/api.ts` like every other pane and has its own loading, error and retry states.

## MCP

- **Transport**: stdio only. The client owns the process; nothing binds a port, and there is no token because there is no network surface.
- **Modules** in `apps/mcp/src`: `vault.ts` (which vault is served, and what a note key means), `tools.ts` (the twelve operations, as plain functions over a vault directory), `render.ts` (how a result is written for the model), `server.ts` (the tool schemas and descriptions), `index.ts` (the stdio entry point).
- **Access to the vault**: `@lumos/vault-utils` directly, not the daemon's HTTP API - an agent should be able to read a folder of Markdown without the capture service running. `resolveNote()` repeats the containment check because a read is the one operation that would otherwise hand back any file on disk.
- **Guidance**: the server's `instructions` tell a model what the tools cannot - that these are a person's notes, that a body is replaced rather than patched, and that a delete goes to the trash. A refusal the vault wrote is answered as a tool error with its own sentence; anything unexpected is thrown rather than turned into advice.

## Vault

- Plain Markdown files with YAML frontmatter.
- Folders: a directory each, so the set is whatever the vault holds. `Inbox`, `Ideas`, `Interviews`, `Goals` and `Reading` are the seed a new vault starts with; `/newfolder <name>` (or `POST /folders`) adds more, `/renamefolder <from>\|<to>` (or `PATCH /folder`) renames one carrying its notes and the links that named it, `/delfolder <name>` (or `DELETE /folder`) moves its notes to Inbox, and `listFolderNames()` in `@lumos/vault-utils` is the one place the set is read.
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
- **Agents read the vault, not an export of it.** The MCP server goes through `@lumos/vault-utils` rather than the daemon's routes, so reading notes does not depend on the capture service being up. Given up: the HTTP routes' own validation is not in that path - the same functions and the same containment check are.

## Tests

- **Runner**: vitest, run by `pnpm test` from the root (every workspace that has a suite).
- **Location**: `*.test.ts` next to the module it covers - no separate `tests/` tree.
- **Coverage today**: `@lumos/vault-utils` (slugify, frontmatter parsing, save/read/list/search, rename/move/delete, link and tag extraction, graph assembly and neighbourhoods, the link classifier's URL shapes and page metadata) and the daemon (the parser, the filing path, the link fetcher's guards and caps, and every HTTP route driven through `app.inject()` without binding a port). The desktop's pure logic is covered too: `src/lib/filter.ts` (the note-list filtering and tag counts) has its own suite behind the desktop workspace's vitest script, and the note viewer's rendering is asserted through SSR renders in `src/components/NoteViewer.test.tsx`. The desktop's components are covered too: `Sidebar`, `NoteList`, `SearchModal`, `LinkPane`, `NoteEditor`, `NoteComposer`, `NoteActions` and `TrashPanel` run in jsdom with Testing Library (`src/components/*.test.tsx`, each file declaring its own environment), so the pure-logic suites stay in Node. The graph canvas is the one component without a test; it needs a real renderer.
- The MCP server's suite (`apps/mcp/src/*.test.ts`) covers the twelve operations against a temporary vault, the key format and every way a key can try to leave the vault, and the real server over the real protocol through the SDK's in-memory transport - so the tool list a client sees and the text it answers with are asserted without spawning a process. `stdio.test.ts` then spawns the entry point the way a client does, because three things are only true out there: the newline framing of its stdout, the message channel over a real pipe, and a clean exit when stdin closes. It also asserts that stdout carries nothing but JSON-RPC, which is the one failure that would end a session on the client's first call.
- The suites run inside `pnpm validate`, so a failing test blocks a push exactly like a failing build.

## Repository Layout

```
lumos/
├── apps/
│   ├── daemon/       # WhatsApp capture service
│   ├── desktop/      # Tauri desktop UI
│   └── mcp/          # MCP server over the vault (stdio)
├── packages/         # @lumos/shared (types) + @lumos/vault-utils (vault ops)
├── docs/             # plan + tracking + reference docs
│   ├── PLAN.md TODO.md PROGRESS.md FEATURES.md ARCHITECTURE.md LIMITATIONS.md
│   └── daemon.md desktop.md vault.md mcp.md design.md roadmap.md
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
- **Husky hooks** — `pre-commit` runs lint-staged on the staged files; `commit-msg` runs
  commitlint; `pre-push` runs `pnpm validate` (lint + format:check + typecheck + test + build). None
  of the hooks can be bypassed.
- **One TypeScript version** (`~6.0.3`) across every workspace, each with a `typecheck` script.
- **Workflow:** one branch, `main` — commits land there directly and are pushed there, one topic per
  commit so any change can be reverted on its own. The hooks and CI are the gate. See
  [RULES.md §6](../RULES.md).
- **CI:** `.github/workflows/validate.yml` runs `pnpm validate` and `pnpm test:e2e` as two jobs on every push
  to `main` (and on every pull request, for a fork). It calls the same `validate` script the hooks do, reads pnpm's version from the
  `packageManager` field, and caches the pnpm store against `pnpm-lock.yaml`. A second job runs
  `pnpm test:e2e` against a real Chromium. Because work lands on `main` directly, CI reports on a
  push after it has arrived; the blocking gate is the local `pre-push` hook.
