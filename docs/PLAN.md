# Lumos - Implementation Plan

## Overview

Lumos is a local-first second brain that captures thoughts via WhatsApp and stores them as structured Markdown in a vault. The desktop UI provides a minimal dark-themed interface for browsing and managing notes.

## Goals

- **Local-first**: All data stays on device. No cloud dependency for core functionality.
- **Frictionless capture**: Capture from WhatsApp, where you already are.
- **Vault-centric**: Plain Markdown files with YAML frontmatter, Obsidian-compatible (inspiration, not replica).
- **Clean minimal UI**: Dark shadcn/ui style with a near-black background, no heavy color.
- **Extensible**: The daemon is bridge-agnostic; the desktop app grows into the primary viewing/management interface.

## Non-Goals

- Not a full Obsidian clone (no plugin system, no canvas; the graph is a link-graph view over Markdown, not an editing surface).
- Not a cloud sync product (local-first only).
- Not a multi-user/collaboration tool.

## Tech Stack

### Daemon (capture)
- Node.js + TypeScript + tsx
- Fastify (HTTP API)
- Baileys `@whiskeysockets/baileys` (WhatsApp Web multi-device)
- pino (logging), qrcode-terminal (QR display)
- link expansion: none - `@lumos/vault-utils/link` reads the metadata and text itself
- Ollama over its HTTP API for local AI planning/enrichment - one `POST /api/generate` from `plan.ts`, no client library

### Desktop (UI)

In use today:

- Tauri 2.x + Rust backend
- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui-style tokens (components)
- react-markdown + remark-gfm (rendering)
- force-graph (link graph, canvas)
- fuse.js (the `Cmd/Ctrl+K` search palette)

Chosen and recorded in the decisions log, but **not installed yet** - the UI currently does the job
with plain React state and a local filter:

- TanStack Router (routing)
- zustand (state)
- lucide-react (icons)

### Shared / Infra
- pnpm workspaces (pnpm only)
- One TypeScript version (`~6.0.3`) across all four workspaces; the desktop app additionally uses a tsconfig project reference for its Vite config
- vitest (tests), run inside the `pnpm validate` gate
- oxlint (lint) + prettier (format)
- Husky hooks, lint-staged, commitlint

## Implementation Phases

0. **Phase 0: Enforcement & Workflow** - oxlint + prettier, Husky hooks (pre-commit / commit-msg / pre-push), the `pnpm validate` gate, and the branch-based workflow recorded in `RULES.md`, `AGENTS.md` (agents) and `CLAUDE.md` (Claude Code). Every phase below ships through these gates.
1. **Phase 1: Docs & Tracking Foundation** - PLAN, TODO, PROGRESS, FEATURES, ARCHITECTURE, CONTRIBUTING, CHANGELOG, docs/*. Establishes the source of truth for what is built vs being built.
2. **Phase 2: Shared Packages** - `packages/shared` (types) and `packages/vault-utils` (vault ops); refactor the daemon to use them.
3. **Phase 3: Daemon Enhancements** - Link expansion, `/find`, `/plan` with Ollama, tag extraction, config file, tests.
4. **Phase 4: Desktop UI Foundation** - shadcn/ui dark theme setup, app shell layout, routing, state.
5. **Phase 5: Vault Browser** - Sidebar (folders), note list, note viewer, vault scanning/indexing.
6. **Phase 6: Search & Discovery** - Full-text search, Cmd/Ctrl+K modal, tag filtering, recent notes.
7. **Phase 7: Editing & Enrichment** - Note editor, link enrichment, bulk operations.
8. **Phase 8: Polish & Docs** - UI polish, performance, tests, complete documentation.
9. **Phase 9: Agent access (MCP)** - an MCP server over the vault (`apps/mcp`), so Claude Code and other agents read and write the notes themselves, plus the connection guide in `docs/mcp.md`.

## UI Design Direction

Dark minimal, shadcn/ui inspired:

- Background near-black (`hsl(0 0% 3.9%)`, ~`#0a0a0a`).
- Surfaces slightly lighter, subtle borders.
- High-contrast text, restrained accent.
- No gradients, no heavy shadows, no vibrant color.
- Emphasis on typography, spacing, and clarity.

Layout: resizable panes - **Sidebar (folders) | Notes list | Note viewer** - with keyboard-friendly navigation.

## Documentation Plan

Root keeps only what convention demands: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`, plus the standards files `RULES.md`, `AGENTS.md` and `CLAUDE.md`.

`docs/` holds everything else: `PLAN.md`, `TODO.md`, `PROGRESS.md`, `FEATURES.md`, `ARCHITECTURE.md`, `LIMITATIONS.md`, `daemon.md`, `desktop.md`, `vault.md`, `design.md`, `roadmap.md`. Docs are cross-linked by relative path and moved with `git mv` so history survives.

## Tracking Conventions

- `[!]` needs a manual check by a person, `[ ]` todo, `[~]` in progress, `[x]` done.
- Priority tags: `P0` critical, `P1` high, `P2` medium, `P3` low.
- `PROGRESS.md` is chronological; `FEATURES.md` is the status matrix; `TODO.md` is the actionable
  checklist; `LIMITATIONS.md` is what is knowingly not possible today.
- `TODO.md` and `FEATURES.md` are ordered by standing, not by phase: what only a person can check
  first, then what is planned, then what is in progress, then what is done. The phase a piece of
  work belongs to stays on the item, so the phases below still map onto it.

## Milestones

- **M0** Tooling & Enforcement (Phase 0)
- **M1** Tracking Docs (Phase 1)
- **M2** Shared Packages (Phase 2)
- **M3** Daemon Enhanced (Phase 3)
- **M4** Dark UI Foundation (Phase 4)
- **M5** Vault Browser MVP (Phase 5)
- **M6** Search (Phase 6)
- **M7** Editing + Polish (Phases 7-8)
- **M8** Agent Access (Phase 9)

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| UI kit | shadcn/ui + Tailwind | Clean, dark-first, minimal, copy-in components |
| Routing | TanStack Router | Type-safe routes |
| State | zustand | Lightweight, simple |
| Search | fuse.js | Fuzzy, client-side, fast enough for a personal vault |
| Markdown | react-markdown + remark-gfm | Standard, safe rendering |
| Icons | lucide-react | Consistent, minimal |
| WhatsApp | Baileys | Node-native, no Docker needed |
| Local AI | Ollama (small model) | Local-first planning/enrichment |
| Default `/plan` model | `llama3.2:3b` - small enough for a laptop, close in spirit to the two candidates this plan named; `gemma2:2b` stays the alternative, one setting away |
| Tests | vitest | One runner for the Node and React code, and it runs inside `pnpm validate` so a red suite blocks a push |
| Linter | oxlint | Fast, and compatible with the TypeScript version in use |
| Formatter | prettier | One formatter, no style debates; runs on staged files |
| Git hooks | Husky + lint-staged + commitlint | The standards are enforced, not aspirational |
| Branching | One branch, `main`, one topic per commit | No merge to perform for a solo change; `git revert` is the way back. Given up: a review step in front of `main` |
| TypeScript version | One version (`~6.0.3`) across all workspaces | Avoids cross-package type mismatches |
| Agent access | MCP server over stdio, one vault per process | The protocol is the client's, not ours: one small server beats an export or a plugin per client. Given up: agents work on the real files, so a careless one can edit what you wrote - which is why every write is recoverable and the trash stays |
| MCP transport | `@modelcontextprotocol/sdk` (and `zod`, which it dedupes to) | Version negotiation, the transports and the tool schemas are the part worth not hand-rolling beside clients that keep moving. Given up: the first dependency in the workspace that is not the app's own - the server is ~350 lines, and the protocol is the rest |
| MCP server's access | `@lumos/vault-utils` directly, not the daemon's HTTP API | An agent should be able to read a folder of Markdown without the capture service running, and a second hop would add no guard the shared library does not already carry. Given up: the routes' HTTP-level validation is not in this path - the same functions are, and the containment check is repeated where a read would otherwise reach any file |
| Animated explainers ([lantern](https://github.com/ivarvong/lantern)) | Evaluated, not adopted | It is a zero-dependency TypeScript port of manim's core: steppable, animated SVG explainers of *code changes*, not on npm. Lumos has no surface that explains code, so vendoring a rendering engine would be weight without a use. Revisit if an "explain this diff" pane ever becomes real |
| Link scraping | Hand-written extraction in `@lumos/vault-utils/link`, no new dependency | `link-preview-js` and cheerio would add weight to a package that stays side-effect free and browser-safe; the subset needed (title, og tags, readable text) is a few pure functions the tests can pin. Given up: the edge cases a full HTML parser handles |

## Open Questions


- ~~Search scope (filename + content + frontmatter?)~~ - resolved: title, tags and body, in `searchNotes`, shared by `/find` and `GET /notes/search`.
- Editor approach (plain textarea + preview first; richer editor later).
- Vault location (keep default `../../vault`; make configurable in UI later).
- ~~Link expansion library (link-preview-js vs. fetch + cheerio)~~ — resolved: neither (see the decisions log).

These are resolved during implementation and recorded in the decisions log.
