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

### Added (continued 11)
- Tag filtering in the note list: the tags present in the current folder and query are offered as
  chips with their note counts, clicking one narrows the list, and a note's own tag is a clickable
  filter too. A selected tag survives a folder change and the empty state names it, so the filter is
  never silently hiding notes. Selecting a tag node in the graph offers **Show notes** with the same
  filter. The matching lives in `src/lib/filter.ts` and is unit-tested - the desktop workspace now has
  a `test` script of its own.

### Fixed
- The offline demo vault now lists the tags its note bodies already carried, so the chip row is no
  longer empty while the graph draws tag nodes. Two demo notes share `#rust`, which is what makes the
  counts mean something offline, and one note stays untagged so that case is visible too. A test
  compares the listing to the bodies and fails if a body tag is left out.

### Added (continued 12)
- Full-text search from the keyboard: `Cmd/Ctrl+K` opens a palette over the whole vault. Titles, tags
  and previews are ranked locally with `fuse.js` - typo-tolerant, and it works with the daemon
  stopped. When the daemon is running the same query also goes to `GET /notes/search`, so a word that
  only appears deep in a note body still finds it, and those rows are marked "in the body". Arrow keys
  move, `Enter` opens the note in the Notes view, `Esc` closes, and focus goes back where it was. The
  status bar carries a Search button with the shortcut beside it, so the palette is reachable without
  knowing the key.
- `src/lib/search.ts`: the ranking and the merge of local and body matches, with 10 unit tests.
- New dependency in the desktop workspace: `fuse.js` (lockfile updated).

### Added (continued 13)
- Backlinks in the note viewer: a note now shows the notes that link to it, and each one opens on
  click. The list comes from the graph the app already loaded, so it needs no request and works with
  the daemon stopped. Only note links count - a shared tag is a neighbour in the graph, not something
  that points at the note - and the rule lives in `backlinks()` in `@lumos/vault-utils/graph`, beside
  the neighbourhood code, with 5 unit tests.


### Added (continued 14)
- The graph no longer reshuffles itself when you leave the tab and come back. Node coordinates are
  remembered outside the component (`src/lib/graph-layout.ts`), so the next mount hands each node the
  place it had and the layout resumes instead of running again. A view you panned or zoomed yourself
  is restored exactly, down to the zoom and the graph-space centre; a view the app fitted itself is
  fitted again, because the pane may be a different size by then. Coordinates for notes that have
  left the vault are dropped, so a deleted note cannot leave a stale place behind for a new one.
- The first fit now happens when the layout settles rather than on a timer. A fit taken 250 ms in
  framed the graph where the nodes were on their way to, which left the outer ones off the edge
  (`#goals` sat on the bottom border of a seven-note vault); the engine's stop is the honest signal.
- A resized pane is refitted, so the graph stops drifting off-centre until someone presses *Fit*. A
  view the user placed is left alone: only *Fit*, a filter change or a depth change takes it back,
  which is a choice, not an oversight - an explicit pan is worth more than an automatic one.
- 12 unit tests over the layout memory: a coordinate is kept, a node this pass did not see is kept, an
  unplaced or NaN node is ignored, the input map is not mutated, pruning drops a gone note, seeded
  nodes are copies, and an unusable camera (zoom 0 or NaN) is refused on the way in.

### Added (continued 15)
- Fenced code in a note is syntax-highlighted. `rehype-highlight` (highlight.js through lowlight) runs
  in the viewer's markdown pipeline over the 37 common languages, and the token colours are
  `--color-code-*` tokens beside the graph hues in `src/index.css` rather than an imported theme, so a
  keyword, a string, a comment and a number each read apart on the app's near-black background.
- Only a fence that names its language is highlighted. An untagged block stays plain, and a language
  outside the registered set is left as text and reported on the file instead of throwing, so an
  unknown fence cannot break a note. Guessing would colour prose and JSON alike as something they are
  not, so `detect` stays off.
- Three render tests in `src/components/NoteViewer.test.tsx` (`renderToStaticMarkup`, no jsdom): a `js`
  fence produces keyword and number spans, a `zig` fence stays plain, and an untagged fence gains no
  highlighting. The desktop suite is 40 tests, 239 in `pnpm validate`.
- The bundle cost is measured, not assumed: `vite build` before and after puts the main desktop chunk
  at 435 kB → 602 kB (135 kB → 189 kB gzipped). The graph keeps its own lazy chunk.

### Added (continued 16)
- An empty `Cmd/Ctrl+K` palette is no longer a dead end: it lists the notes opened this session,
  newest first, up to five. Every route into a note counts - the list, a graph node, a backlink or the
  palette itself - because they all pick through one function in `App`, and the rows use the same
  result shape as a search, so `↑`/`↓`/`Enter` work there without a second key handler.
- `src/lib/recent.ts`: `rememberRecent()` (newest first, de-duplicated, capped, pure) and
  `recentEntries()` (keys resolved against the live listing, so a note deleted or moved while the app
  runs is skipped rather than offered as an empty row), with 10 unit tests. Desktop suite 50, total
  249.
- The history is session memory: no storage is written, so a reload starts empty, and the note the
  app selects for you at launch is not recorded - only what you actually opened. Both stated in
  [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

### Added (continued 17)
- A scraped page is now kept for the session instead of being fetched again every time its note is
  reopened. `src/lib/link-cache.ts` holds the card by URL at module scope - the pane unmounts on a
  note or tab change, so a cache inside it would be gone exactly when it is worth having - and a
  second caller joins the request already in flight, which also turns React StrictMode's double mount
  into one request rather than two.
- The pane reads the cache at render, so returning to a note with a page it already holds shows the
  card immediately instead of flashing "Reading the page…" first.
- A refusal or a network failure is deliberately not remembered, so **Retry** still makes a real
  request. Nothing has a TTL and nothing is written to disk: a reload starts empty, and a page that
  changed mid-session is still shown as it was. Both limits are in
  [docs/LIMITATIONS.md](docs/LIMITATIONS.md).
- 7 unit tests over an injected fetcher (no network): one fetch for two reads, a joiner, a failure
  retried for real, one entry per URL, `peek` never starting a request, `peek` staying empty while a
  read is in flight, and `clear` forcing the next read out. Desktop suite 57, total 256.

### Added (continued 18)
- `j` and `k` move the note-list selection in the Notes view. The step stops at both ends rather than
  wrapping, and a move counts as an ordinary pick, so it feeds the palette's recent notes; it stands
  down while a field has focus or the palette is open, so the letter is never stolen from a search
  box.
- The arithmetic and the "is this a field?" rule live in `src/lib/list-nav.ts`, with 8 unit tests,
  because a key handler is awkward to assert without a DOM and the rule is what tends to go wrong.
  Desktop suite 65, total 264.

### Added (continued 19)
- The note list is resizable, so a long title or a narrow window no longer decides the split for you.
  `PaneSplitter` sits between the list and the viewer: drag it, double-click to reset, or focus it and
  use `←`/`→` for a 16px step and `Home` for the default. It is a real `separator` with
  `aria-valuemin`/`max`/`now` and a pixel `aria-valuetext`.
- The 240-560px bounds and the clamping live in `src/lib/pane-size.ts` with 7 unit tests, so the drag
  and the arrow keys cannot disagree; the width is held in `App` rather than in the list, which keeps
  it while the Graph tab has the list unmounted. Nothing is persisted, so a reload starts at 320px.
  Desktop suite 72, total 271.

### Added (continued 20)
- A note with broken frontmatter no longer disappears. Unparseable YAML, and a block that is a list
  or a bare string rather than a mapping, used to throw inside `parseNote`; the listing swallowed the
  error and the note vanished from the app with nothing said. The body is now read anyway, and the
  reason travels with the note.
- `validateFrontmatter()` in `@lumos/vault-utils` checks the fields the app actually depends on -
  `created` (the date the list sorts by), `tags` (the filter), `source` (the header) and `url` (what
  the viewer may play) - and lets every other key through, because frontmatter is meant to grow.
- The problem is reported, not repaired: `Note.problems` carries it to the viewer, which shows a
  warning above the body, and the list marks the row `! frontmatter` with the details in its tooltip.
  A `created` that cannot be parsed is kept as written rather than replaced with "now", so the file
  says what is wrong instead of quietly sorting somewhere else.
- A note that is fine is unchanged: `VaultEntry.problems` is only present when there is something to
  say, and an empty frontmatter block is still a note with defaults, not a broken one.
- 12 validator tests, 8 over parsing and listing, 2 over the routes and 3 render tests for the
  warning. Suite is 296: 136 in `@lumos/vault-utils`, 85 in the daemon, 75 in the desktop.

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
- The desktop vault browser renders Markdown notes, filters by tag, highlights fenced code, resizes
  its list pane and carries a `Cmd/Ctrl+K` palette, backlinks and a link graph. Routing
  (TanStack Router), zustand and a note editor are still to come, tracked under **Plan** in
  [docs/TODO.md](docs/TODO.md). The desktop suite is 108 tests: 75 over pure logic and SSR renders,
  and 33 over the sidebar, note list, palette and link pane in jsdom.
- Writing the tests turned up two small gaps. The read-API routes could not be tested until the Fastify
  app was extracted from `server.ts`, which is now done. `/help` did not list itself in the command
  list it printed; that is fixed, and a test pins every line of the list in order so the next command
  cannot be left out of it.
- `main` is protected in three places: the `pre-commit` hook refuses a commit there, the
  `pnpm validate` workflow runs on every PR and every push, and GitHub branch protection requires
  that check before a pull request can merge, with the branch kept up to date and force pushes and
  deletions blocked. Administrators can still push directly, so it is a guardrail rather than a
  lock — [docs/LIMITATIONS.md](docs/LIMITATIONS.md) says so.

### Fixed (continued)
- A route that fails for a reason none of them anticipated answers a plain
  `500 { "error": "The daemon could not finish that request." }` instead of Fastify's default, which
  put the error's own message in the body. For a filesystem failure that message is the absolute
  path, so the reply no longer says where the vault is. The detail is not lost: the log records the
  error's `name` and `code` against the request id, and still never the path. A `4xx` Fastify raises
  itself keeps its own message, so a malformed JSON body still says what was wrong with it.
- Two route tests: the app built over a vault path that is a file, so `GET /notes` reaches `readdir`
  and the failure is real rather than a stub, asserting the plain `500` and that the body carries
  neither the path nor the error code; and a malformed body asserting the `400` still names its
  cause. Suite is 298: 136 in `@lumos/vault-utils`, 87 in the daemon, 75 in the desktop.

### Added (continued 21)
- The desktop's components have tests. jsdom and Testing Library (`@testing-library/react`,
  `@testing-library/dom`) are dev dependencies of the desktop workspace, and 33 tests cover the four
  components that carry state: the folder sidebar, the note list, the `Cmd/Ctrl+K` palette and the
  link pane. Each test file declares `// @vitest-environment jsdom` at the top, so the pure-logic
  suites keep running in Node and no global test configuration changed.
- What they assert is behaviour: which folder and view are marked active and what a click hands
  back, the loading state, the empty state and the one that names an over-narrowing tag, a row
  opening the note it belongs to, a note with broken frontmatter showing its badge and the reasons
  in its title, a tag chip switching a filter on and off (including for a tag whose notes are gone),
  the palette's recent notes with the arrow keys and `Enter`, `Escape` closing it, a body match
  arriving marked "in the body", and the link pane's YouTube and Instagram embeds, its image case,
  its reader states and a **Retry** that costs a second request because a failure is not cached.
- The suite is 331: 136 in `@lumos/vault-utils`, 87 in the daemon, 108 in the desktop (75 before).
  The graph canvas remains untested - it draws through the graph library and jsdom cannot render it -
  and an end-to-end test in a real browser is still open, tracked under **Plan** in
  [docs/TODO.md](docs/TODO.md).

### Changed (continued)
- The link reader now shows the page's prose instead of whatever the markup contained. Whole `<pre>`
  code samples are dropped, together with the chrome elements (`nav`, `header`, `footer`, `aside`,
  `form`, `dialog`, `button`, `select`), a line that only repeats the line before it, a line that is
  nothing but a bracketed label such as `[ edit ]`, and the payload of any `data-` attribute. Inline
  `<code>` inside a sentence stays, because that is part of the sentence.
- Measured through `GET /link`, before and after, on pages that show both symptoms. MDN's `if...else`:
  206 lines with 37 code-ish lines and 32 repeated, down to 115 lines with none of either.
  Wikipedia's Markdown article: it used to open with "33 languages" and the whole language list, and
  carried one enormous serialized-template line; it now opens with "From Wikipedia, the free
  encyclopedia" and the blob is gone. The blob was the interesting one - it lived in a `data-mw`
  attribute whose JSON contains a `>`, which ended the tag early.
- This is still a string pass, not a parser, so a block nested in the same tag closes at the first end
  tag and chrome inside a plain `<div>` comes through. [docs/LIMITATIONS.md](docs/LIMITATIONS.md) says
  what that gives up.
- 6 new tests in `@lumos/vault-utils` for the behaviour rather than the line counts. Suite is 337: 142
  in `@lumos/vault-utils`, 87 in the daemon, 108 in the desktop.

### Added (continued 22)
- The daemon reads its settings from `lumos.config.json` - `vaultPath`, `port`, `allowedNumbers` and
  `whatsapp` - with the environment overriding it. Precedence is environment > file > default, so a
  one-off `VAULT_PATH=... pnpm dev` keeps working while a file is present. The file is git-ignored,
  because a vault path and phone numbers belong to one machine, and `LUMOS_CONFIG` points elsewhere.
- A relative `vaultPath` resolves against the file that named it rather than the working directory,
  so the same file means the same vault however the daemon was launched.
- A missing file is not an error. A file that is unreadable, not JSON, carries an unknown key or a
  setting that cannot be used stops the daemon with one sentence on stderr and exit code 1 - an
  unknown key is refused instead of ignored, so a typo cannot silently do nothing.
- `PORT=0` is refused rather than listened on: the old code accepted it and bound a random port,
  which the desktop could not find.
- `vault.ts` is gone; `config.ts` is the one place settings are decided. 12 tests, and the process
  was run against a real file (configured port 3111, relative vault, environment override to 3112).
  Suite is 349: 142 in `@lumos/vault-utils`, 99 in the daemon, 108 in the desktop.
