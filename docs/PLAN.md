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
- link-preview-js (planned) for link expansion
- ollama-js (planned) for local AI planning/enrichment

### Desktop (UI)
- Tauri 2.x + Rust backend
- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui-style tokens (components)
- TanStack Router (routing)
- zustand (state)
- react-markdown + remark-gfm (rendering)
- force-graph (link graph, canvas)
- fuse.js (full-text search)
- lucide-react (icons)

### Shared / Infra
- pnpm workspaces (pnpm only)
- TypeScript project references, one TypeScript version across the workspace
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

`docs/` holds everything else: `PLAN.md`, `TODO.md`, `PROGRESS.md`, `FEATURES.md`, `ARCHITECTURE.md`, `daemon.md`, `desktop.md`, `vault.md`, `design.md`, `roadmap.md`. Docs are cross-linked by relative path and moved with `git mv` so history survives.

## Tracking Conventions

- `[ ]` todo, `[~]` in progress, `[x]` done.
- Priority tags: `P0` critical, `P1` high, `P2` medium, `P3` low.
- `PROGRESS.md` is chronological; `FEATURES.md` is a status matrix; `TODO.md` is the actionable checklist.

## Milestones

- **M0** Tooling & Enforcement (Phase 0)
- **M1** Tracking Docs (Phase 1)
- **M2** Shared Packages (Phase 2)
- **M3** Daemon Enhanced (Phase 3)
- **M4** Dark UI Foundation (Phase 4)
- **M5** Vault Browser MVP (Phase 5)
- **M6** Search (Phase 6)
- **M7** Editing + Polish (Phases 7-8)

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
| Tests | vitest | One runner for the Node and React code, and it runs inside `pnpm validate` so a red suite blocks a push |
| Linter | oxlint | Fast, and compatible with the TypeScript version in use |
| Formatter | prettier | One formatter, no style debates; runs on staged files |
| Git hooks | Husky + lint-staged + commitlint | The standards are enforced, not aspirational |
| Branching | Short-lived `<type>/<description>` branches, PR into `main`, squash-merge | `main` stays releasable; every change is reviewable in isolation |
| TypeScript version | One version (`~6.0.3`) across all workspaces | Avoids cross-package type mismatches |

## Open Questions

- Default Ollama model for `/plan` (candidates: `llama3.2:3b`, `gemma2:2b`).
- Search scope (filename + content + frontmatter?).
- Editor approach (plain textarea + preview first; richer editor later).
- Vault location (keep default `../../vault`; make configurable in UI later).
- Link expansion library (link-preview-js vs. fetch + cheerio).

These are resolved during implementation and recorded in the decisions log.
