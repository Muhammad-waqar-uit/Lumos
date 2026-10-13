# Changelog

All notable changes to Lumos are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Monorepo scaffold with pnpm workspaces (`apps/daemon`, `apps/desktop`, `packages`).
- Daemon core: command parser, vault writer, message handler, Fastify HTTP API.
- WhatsApp bridge via Baileys with QR authentication, sender allowlist, and auto-reconnect.
- Project documentation: `PLAN.md`, `TODO.md`, `PROGRESS.md`, `FEATURES.md`,
  `ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and the `docs/` set.
- Shared workspace packages: `@lumos/shared` (core types) and `@lumos/vault-utils`
  (slugify, frontmatter parse/serialize, read/list/search/write). The daemon is refactored onto them.
- MIT `LICENSE`.

### Added (continued)
- Daemon read API: `GET /notes`, `/notes/search`, `/folders`, and `/note`, with CORS for local
  origins and guards against path traversal.
- Desktop dark UI: Tailwind v4 design tokens and a three-pane shell (folder sidebar, note list,
  note viewer, status bar) that loads the vault from the daemon with a demo-data fallback.

### Added (continued 2)
- Development tooling and enforcement: oxlint, prettier, lint-staged, commitlint and Husky hooks
  (`pre-commit`, `commit-msg`, `pre-push`) that cannot be bypassed.
- Root scripts `lint`, `format`, `format:check`, `typecheck`, `build` and `validate`.
- A branching model: work happens on short-lived `<type>/<short-description>` branches and lands in
  `main` through a pull request. The `pre-commit` hook rejects direct commits to `main`.
- `RULES.md` (build, commit and branch standards), `AGENTS.md` (working agreement for AI agents) and
  `CLAUDE.md` (Claude Code entry point).

### Added (continued 3)
- The note viewer renders Markdown instead of preformatted text: headings, nested and ordered
  lists, tables, task lists, blockquotes, fenced code and links (`react-markdown` + `remark-gfm`).
  Note links open outside the window so the vault view is never navigated away.

### Changed
- All four workspaces now pin the same TypeScript version (`~6.0.3`) and expose a `typecheck` script.
- New dependencies in the desktop workspace: `react-markdown` and `remark-gfm` (lockfile updated).
  Note styling reuses the existing dark theme tokens, so no new colour values were introduced.
- Generated Tauri schemas are excluded from formatting; the repository is prettier-clean.
- `CONTRIBUTING.md` and `README.md` now point at the enforced rules and the branch workflow.
- Fixed two React anti-patterns the new React lint rules found: note text and the search box now
  derive state during render instead of repairing it inside an effect.

### Notes
- The desktop vault browser renders note text; Markdown rendering, tag filtering, resizable panes,
  routing, and a note editor are still to come.
- `main` is protected by convention and by the hook; GitHub-side branch protection and CI are not
  configured yet (tracked in [docs/TODO.md](docs/TODO.md)).
