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

### Added (continued 4)
- A test suite run by vitest 5: 112 tests, 75 for `@lumos/vault-utils` (slugify, title choice,
  frontmatter parsing including BOM and CRLF files, save/read/list/search, link and tag extraction,
  graph assembly and neighbourhoods, all against a temporary vault) and 37 for the daemon
  (`parseMessage` for every command and for malformed input, plus `handleMessage` filing real notes,
  answering `/find` and filing `/find` matches).

### Added (continued 5)
- A vault link graph. Note bodies are scanned for `[[wikilinks]]`, relative `.md` links and hashtags;
  notes and tags become nodes, links and tag references become edges, and a note that nothing points
  at is marked an orphan. Links whose target does not exist are reported as unresolved instead of
  being invented as nodes. The pure graph code lives in `@lumos/vault-utils` (a browser-safe
  `./graph` entry point), so the daemon and the desktop share one implementation.
- `GET /graph` on the daemon read API returns that graph.
- A Graph view in the desktop app: a canvas force layout with glow nodes sized by backlink count,
  curved edges, one hue per folder, and controls for tags, unlinked notes and a local depth that
  narrows the graph to the notes near the open one. Clicking a node selects it, and a button opens it
  in the Notes view. With the daemon down the pane shows the demo graph instead of an empty screen.

### Added (continued 6)
- `/find <query>` searches the vault from WhatsApp or the HTTP API and replies with the title and
  folder of each match — up to five, with the remainder counted. Matching is case-insensitive across
  titles, tags and body text, and it reuses `@lumos/vault-utils` `searchNotes`, so `/find` and
  `GET /notes/search` cannot drift apart.

### Fixed
- Palette steps that only TypeScript referenced never reached the browser: Tailwind prunes theme
  values it cannot see used in a class name, so the graph colours are declared as plain `:root`
  custom properties.
- A failed lazily loaded chunk used to leave the whole app blank; the graph pane now renders an
  error with a retry, so one broken pane cannot take the vault view down with it.
- The Graph tab renders through the graph library's vanilla instance API. Its React wrapper forwards
  props by method name and silently drops the canvas-object props and `autoPauseRedraw`, so styling
  set as component props never applied.

### Changed
- New dependency in the desktop workspace: `force-graph` (canvas), loaded lazily with the Graph tab
  so the notes path is unaffected (lockfile updated). The graph colours reuse existing theme tokens.
- `pnpm validate` now includes the tests: lint + format:check + typecheck + test + build. Use
  `pnpm test` to run the suites on their own.
- All four workspaces now pin the same TypeScript version (`~6.0.3`) and expose a `typecheck` script.
- New dependencies in the desktop workspace: `react-markdown` and `remark-gfm` (lockfile updated).
  Note styling reuses the existing dark theme tokens, so no new colour values were introduced.
- Generated Tauri schemas are excluded from formatting; the repository is prettier-clean.
- `CONTRIBUTING.md` and `README.md` now point at the enforced rules and the branch workflow.
- Fixed two React anti-patterns the new React lint rules found: note text and the search box now
  derive state during render instead of repairing it inside an effect.
- Continuous integration: `.github/workflows/validate.yml` runs `pnpm validate` on every pull request
  into `main` and every push to `main`. It reads pnpm's version from `package.json`, caches the pnpm
  store, and calls the same `validate` script the local hooks run, so the gate is defined in one place.

### Notes
- The desktop vault browser renders Markdown notes; tag filtering, code syntax highlighting,
  resizable panes, routing, and a note editor are still to come. There is no desktop test coverage
  yet — the suites cover the daemon and the vault packages.
- Writing the tests turned up two small gaps, both tracked in [docs/TODO.md](docs/TODO.md): `/help`
  does not list itself in the command list it prints, and the read-API routes cannot be tested until
  the Fastify app is extracted from `server.ts`.
- `main` is protected by convention and by the hook, and the `pnpm validate` workflow now runs on
  every PR and every push. GitHub-side branch protection is still off, so the check is not yet
  required to merge (tracked in [docs/TODO.md](docs/TODO.md)).
