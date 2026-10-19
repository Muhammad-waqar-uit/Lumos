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
- A test suite run by vitest 5, covering `@lumos/vault-utils` (slugify, title choice,
  frontmatter parsing including BOM and CRLF files, save/read/list/search, link and tag extraction,
  graph assembly and neighbourhoods, link parsing and page metadata, all against a temporary vault)
  and the daemon (`parseMessage` for every command and for malformed input, `handleMessage`
  filing real notes and answering `/find`, the link fetcher's refusals and caps, and every HTTP route
  driven through `app.inject()`, with `fetch` and DNS injected so the suite stays offline).

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

### Added (continued 7)
- Links in a note are now playable and readable in place. A YouTube or Vimeo link renders a 16:9
  player on the no-cookie embed host, an image link renders the image, and any other page is fetched
  by the daemon and shown as a card — title, site, description, lead image — with its readable text
  underneath, cut at 6,000 characters with a link to the whole page.
- `GET /link` on the daemon read API returns that card for one URL. A video or an image is answered
  from the URL alone, so playback works with the daemon stopped.
- `@lumos/vault-utils` gained a browser-safe `./link` entry point: `parseLinkMedia`, `extractPreview`
  and `firstExternalLink`, so the desktop and the daemon classify and read links with one
  implementation.
- [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md): what Lumos does not do, or does partly, gathered in one
  place with what each limit gives up — from the reader's JavaScript blind spot and the refused local
  addresses to the WhatsApp session having no automated coverage.

### Added (continued 8)
- The daemon's HTTP routes are testable and tested. `createApp()` in `apps/daemon/src/app.ts` builds the
  Fastify app over a vault directory, so the suite reaches every route through `app.inject()` without
  binding a port; `server.ts` is now only an entry point. `handleMessage()` takes the vault as an
  argument instead of reading module state, so a test passes a temporary directory and the real vault is
  never touched.
- 22 route tests: the note listings and their empty case, search and its blank query, the folder counts,
  `/note`'s guards (a missing parameter, an unknown folder, and each traversal shape tried against a
  decoy file left outside the folders), the graph's nodes/edges/unresolved links, `/link`'s refusals and
  its 200/400/502 mapping, and the CORS allow-list. The link fetcher is injected, so no test makes a
  network request.

### Added (continued 9)
- Instagram and Facebook links render in place instead of only linking out. `parseLinkMedia()` now
  recognises Instagram permalinks (`/p/`, `/reel/`, `/tv/`, including one written under the account
  name) and Facebook videos, reels, posts and photos, and builds the platform's own embed URL for
  each: the captioned Instagram embed, the Facebook plugin video player, or the taller plugin post
  card that keeps the caption and reaction counts. The classification is pure string work, so an
  embedded reel plays with the daemon stopped, exactly as a YouTube link already did.
- `LinkMedia.frame` (`landscape`, `portrait`, `tall`) tells the desktop how to size an embed, so every
  player is no longer forced into a 16:9 box: an Instagram reel gets a portrait frame and a Facebook
  post a taller card.
- An Instagram or Facebook link is now fetched by `GET /link` for its metadata too. Those pages
  publish no readable text (measured: 0 characters for a public reel), but the caption, site and lead
  image do come through, and they are shown as a card under the embed. With the daemon stopped the
  embed still plays; only the card is missing, and the pane says which part needs the daemon.
- 8 new tests over the new URL shapes: lookalike hosts, `/share/...` and `fb.watch` short links that
  are deliberately left to the reader, empty permalinks, and paths that only look like a video. The
  suite is 188 tests - 107 for `@lumos/vault-utils` and 81 for the daemon.

### Added (continued 10)
- A captured note now gets its tags from the `#hashtags` in the message: `/idea plan the Kyoto trip
  #travel #Japan` lands in `Ideas/` with `tags: [travel, japan]` in its frontmatter, lower-cased and
  de-duplicated. Until now every note was written with `tags: []` and nothing read the hashtags a
  message already carried, so `/find`, the note list's tag display and the graph's tag nodes all had
  nothing to work with.
- The write path reuses `extractTags()` from `@lumos/vault-utils`, the function the graph already
  reads tags with, instead of a second set of rules. One implementation means a tag in the frontmatter
  and a tag node in the graph cannot disagree: a markdown heading and a `#hash` inside a code span or
  fence are still not tags, and `#Rust` and `#rust` are still one tag.
- 5 new tests over tags on the capture path: hashtags in a `/idea` message arriving as frontmatter
  tags, a heading and a code span not producing one, an untagged message staying `[]`, and the tag
  being findable through the folder listing and through `searchNotes`. The suite is 193 tests - 111
  for `@lumos/vault-utils` and 82 for the daemon.

### Fixed
- Documentation that had drifted from the code, found by auditing every Markdown file against the
  repository. `docs/design.md` described tokens the stylesheet does not use (shadcn-style `--background:
  0 0% 3.9%`, `--card` at 3.9%, `--radius`, and a `--destructive` pair that does not exist) while the
  real ones are Tailwind v4 `@theme` entries named `--color-*`, and it omitted the graph tokens and
  why they sit outside `@theme`. `docs/desktop.md` presented `Cmd/Ctrl+K`, `j`/`k` and `Esc` as
  working shortcuts when no key handler is registered, and listed two already-built features as
  planned. `docs/PLAN.md` named TanStack Router, zustand, fuse.js and lucide-react as the desktop
  stack although none is installed. `README.md` still advertised `/find` as "coming soon", dated a
  note `2025-10-13`, and documented two of the eight endpoints; `PORT` and `LUMOS_DISABLE_WHATSAPP`
  were undocumented in both the README and `docs/daemon.md`. `docs/FEATURES.md` described the HTTP API
  as `POST /message` and `GET /health` only.
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
- The Instagram and Facebook embeds are the platforms' plugin endpoints, verified by hand rather than
  by a test: a public reel and a public video each played logged out, in the app and in the packaged
  window's engine, and a post embed rendered its caption and reactions. Nothing is downloaded, so a
  reel stays a link rather than a copy in the vault, and private or embeds-off content will never
  render. What that gives up is written down in [docs/LIMITATIONS.md](docs/LIMITATIONS.md).
- Link fetching is guarded, and the guards are the interesting part: only `http(s)`, no credentials in
  the URL, and a refusal for anything local — `localhost`, `*.local`, `*.internal`, loopback, private,
  link-local, CGNAT and reserved addresses — including a public URL that redirects into them, because
  every hop is checked. Time (8 s), redirects (3) and body size (1 MiB) are capped, and the content
  type has to be HTML, XHTML or plain text. A name is resolved and every answer checked, which closes
  the ordinary rebinding case; a name that resolves publicly and then moves is a known limit of a
  reader on a personal machine.
- The extraction is hand-written rather than a library (`link-preview-js`, cheerio): it keeps
  `@lumos/vault-utils` dependency-light and side-effect free, and gives up the edge cases a full HTML
  parser would handle. Recorded in `PLAN.md`.
- The desktop vault browser renders Markdown notes; tag filtering, code syntax highlighting,
  resizable panes, routing, and a note editor are still to come. There is no desktop test coverage
  yet — the suites cover the daemon and the vault packages.
- Writing the tests turned up two small gaps. The read-API routes could not be tested until the Fastify
  app was extracted from `server.ts`, which is now done. `/help` did not list itself in the command
  list it printed; that is fixed, and a test pins every line of the list in order so the next command
  cannot be left out of it.
- `main` is protected in three places: the `pre-commit` hook refuses a commit there, the
  `pnpm validate` workflow runs on every PR and every push, and GitHub branch protection requires
  that check before a pull request can merge, with the branch kept up to date and force pushes and
  deletions blocked. Administrators can still push directly, so it is a guardrail rather than a
  lock — [docs/LIMITATIONS.md](docs/LIMITATIONS.md) says so.
