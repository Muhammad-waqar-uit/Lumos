# Changelog

All notable changes to Lumos are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- The graph view's React layer is covered by component tests
  (`apps/desktop/src/components/GraphView.test.tsx`, 9 tests): the Tags, Unlinked and depth
  controls, selecting a note or a tag with **Open note**/**Show notes**, and the counts, legend,
  loading and empty states. The canvas's own drawing still needs a real renderer and is not
  asserted.
- Test counts in the documentation can no longer drift. Every `pnpm test` writes a JSON report
  beside its workspace, [docs/TESTING.md](docs/TESTING.md) is generated from those reports
  (`pnpm counts:update`), and `pnpm validate` now fails when the committed table no longer matches
  what the suite ran. The per-workspace counts that used to be restated in the README and the
  feature matrix link to that table instead.
- An MCP server over the vault (`apps/mcp`), so Claude Code, Claude Desktop and any other MCP client
  can work on the notes themselves: twelve tools over stdio - list folders and notes, search, read,
  create, update, rename, move, delete to the trash, list the trash, restore, and make a folder. Notes
  are addressed by the key every tool answers (`Folder/name.md`), a refusal comes back as a tool error
  carrying the vault's own sentence, and every operation runs through `@lumos/vault-utils`, so a note
  an agent writes is an ordinary note stamped `source: mcp`. `LUMOS_VAULT` chooses the vault; the
  default is this repository's. Connection, the tool list and the trade-offs are in
  [docs/mcp.md](docs/mcp.md).
- The WhatsApp link, in the app. The status bar carries a chip with the link's own state -
  `WhatsApp linked`, `Pair WhatsApp`, `WhatsApp disconnected`, `WhatsApp unlinked`, `WhatsApp off` -
  and opens a panel that says why in a sentence, draws the pairing code in the app rather than in a
  browser tab, and offers the one button the state allows. **Disconnect** stops the daemon answering
  messages while keeping the phone linked, so **Connect** needs no code. `GET /whatsapp` is the
  report and `POST /whatsapp/connect`/`disconnect` are the two actions; unlinking a device stays on
  the phone, and the daemon reports `logged-out` when that happens. The report also carries `lastAt`,
  when a message was last answered, so the panel can show a link that is up and idle rather than
  leaving "connected" to mean both things.
- Notes captured while the app is open now appear without a reload. The link's own read carries
  when a message was last answered, so a change there pulls the vault and diffs the listing: one new
  note is named in the status bar with **Open**, several are counted with **Open newest**. Nothing
  jumps the pane - a capture can land mid-edit.
- Commands in the `Cmd/Ctrl+K` palette: **New note** (the composer, in the Notes view), **New folder**
  (name it in the palette, `Enter` makes it and the list looks at it), **Open the graph** and
  **Open the trash**. With nothing typed they sit under the recent notes; typing puts any command
  whose words matched first. They are only offered while the daemon answers.
- Folder rename and removal. `/renamefolder <from>|<to>` and `/delfolder <name>` on WhatsApp,
  `PATCH /folder` and `DELETE /folder` on the API, and **Rename**/**Delete** on every folder row in
  the desktop sidebar. The rename is one directory rename on disk - every note inside keeps its
  filename, date and bytes - and the links that named the old folder are rewritten in the notes that
  carried them; the remove moves the notes to Inbox before dropping the directory, so removing a
  folder never takes a note with it. Files that are not notes are left in place and the folder is
  kept, the same rule the trash follows.
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

### Added (continued 6)
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

### Added (continued 23)
- A note can now be edited in the desktop and saved back to the vault, which until now only WhatsApp
  could write to. **Edit** in the note header turns the body into a textarea; **Save** (`Cmd/Ctrl+S`)
  writes it, **Cancel** (`Esc`) drops the draft, and the header says when there is something unsaved.
  A save that fails keeps the text and shows the daemon's own sentence above it, so a daemon that
  went away cannot cost the user their typing.
- Only the body is written. The frontmatter block is left exactly as the file has it - an invalid
  block, a comment, a key another tool owns and its ordering all survive, because the reader reports
  a broken block instead of hiding the note and the editor has no business repairing it quietly.
- `PUT /note` on the daemon takes `{ folder, name, content }` and answers the note as it now reads.
  The same folder and filename guards as `GET /note`, and a note that does not exist is a `404`
  rather than being created; an empty `content` is a real request (the text was deleted) and is told
  apart from a missing one.
- `@lumos/vault-utils` gained `replaceNoteBody()` (the pure body swap) and `updateNote()` (the write):
  the path is checked against the vault root before anything is read, and the file is written to a
  temporary name and renamed over the note, so a failure part-way leaves the old note intact rather
  than truncated.
- After a save the listing, the folder counts and the graph are re-read, because a new heading
  changes the title, new hashtags change the tags and a new `[[link]]` changes the graph. When that
  refresh fails the status bar says so - the save itself already landed, and that is worth being
  precise about.
- A CORS bug that only the running app could show: `@fastify/cors` defaults to `GET,HEAD,POST`, so
  the browser's preflight for a `PUT` was refused and the editor reported "Failed to fetch" while
  `curl` against the same route succeeded. The daemon now names the methods it serves, and a
  preflight test covers it - the suite had only ever asked with a `GET`.
- 28 new tests: 13 in `@lumos/vault-utils` (the block surviving verbatim, a broken block still
  broken after a save, an empty body, a horizontal rule not being mistaken for the end of the block,
  traversal refused on both the folder and the name, a missing file never created), 7 in the daemon
  (the save, the empty body, every refusal, `404`, other notes untouched, the preflight) and 8 in the
  desktop (the editor's draft, its failure path, `Cmd/Ctrl+S`, one save at a time, cancel, and the
  header offering Edit only while the daemon answers). Suite is 377: 155 in `@lumos/vault-utils`,
  106 in the daemon, 116 in the desktop. Exercised in the running app: the body was rewritten from
  the UI, the file on disk kept its frontmatter, the list title followed the new heading, and with
  the daemon stopped the button is disabled and says why.

### Added (continued 24)
- A note can now be created from the desktop, so the app is no longer read-only for anyone starting
  an empty vault. **New** at the top of the note list opens a composer in the list's own pane - a
  folder picker and a textarea - and **Create** (`Cmd/Ctrl+Enter`) files the note and opens it.
  Enter stays a newline, because it is a textarea first.
- The composer reuses the capture writer rather than growing a second one: the first line becomes
  the title, `#hashtags` become frontmatter tags, and the filename is the usual
  `YYYY-MM-DD-slug.md`, so a note typed here and a note captured on a phone are the same shape of
  file. The allowlist does not apply - that belongs to WhatsApp, not to the machine you sit at.
- The one difference is `source: desktop`. `saveNote()` takes the source as an option defaulting to
  `whatsapp`, so the capture path is unchanged. The field is shown to the person reading the note,
  and a note that claims the wrong origin is worse than one that says nothing.
- The folder starts where the list is looking (Inbox when it is showing all), because a new note
  usually belongs where you already are. A failed create keeps the draft and shows the daemon's own
  sentence, exactly as a failed save does, and with the daemon stopped the button is disabled and
  says why - the demo vault is not a vault.
- `POST /notes` on the daemon, beside `PUT /note`: a missing folder, a missing `text` or text that
  is only spaces is a `400 folder and text are required`; a folder outside the known set is a `400`
  and nothing is written anywhere; a second note with the same text gets its own file, because the
  writer has never overwritten.
- After a create the listing, the folder counts and the graph are re-read and the new note is opened
  by the key the daemon answers, so "created" is a result rather than a submission.
- 14 new tests: 1 in `@lumos/vault-utils` (the source, defaulting to WhatsApp), 5 in the daemon
  (the create and its origin, the listing after it, every bad payload, an unknown folder leaving the
  vault untouched, and never overwriting) and 8 in the desktop (the folder list, the create, the
  failure keeping the draft, `Cmd/Ctrl+Enter`, a plain Enter staying a newline, one create at a
  time, and cancel). Suite is 391: 156 in `@lumos/vault-utils`, 111 in the daemon, 124 in the
  desktop.

### Added (continued 25)
- A note's file can now be changed from the app: the **...** button in the note header opens
  **Rename**, **Move** and **Delete**, so a note filed in the wrong folder is no longer something you
  have to fix in an editor. Rename takes a title, and the daemon renames the file after it and
  rewrites the body's first heading, so the list, the viewer and the filename agree afterwards. Move
  offers only the folders the note is not already in and keeps the filename, because the date in it
  is the note's. Delete asks first, then removes the file.
- `PATCH /note`, `POST /note/move` and `DELETE /note` on the daemon, with `@lumos/vault-utils`
  `renameNote()`, `moveNote()` and `deleteNote()`. A refusal is `400` for an unsafe path, `404` for a
  note that is not there and `409` when the target name is already taken - a rename or a move never
  replaces one note with another, and the CORS allow-list names `PATCH` and `DELETE` so the browser
  can send them.
- An operation's failure keeps the panel open and shows the daemon's own sentence, and the listing,
  folder counts and graph are re-read after one; a move switches the list to every folder, so the note
  you just moved does not vanish behind the folder filter. With the daemon down the button is
  disabled and says why.
- 43 new tests: 17 in `@lumos/vault-utils` (the move, the rename with its heading, the date prefix,
  a collision on either operation, an empty title, a missing note, and a path that escapes the vault),
  13 in the daemon (both routes and the delete, each refusal, the `409`s and the preflight) and 13 in
  the desktop (the panel's menu, rename, move, the confirming delete, a failure keeping it open, and
  the header offering the operations only while the daemon answers). Suite is 434: 173 in
  `@lumos/vault-utils`, 124 in the daemon, 137 in the desktop.

### Added (continued 26)
- A rename now carries the links that point at the note, so it cannot quietly break every backlink in
  the vault. Every other note whose body links to the old title is rewritten to the new one, keeping
  the shape it was written in - `[[Learn Rust]]` becomes the new title, `[[2026-10-20-learn-rust.md]]`
  becomes the new filename, and a `#heading`, a `|alias` or an `!` embed marker survives - and
  `PATCH /note` answers the files it touched as `updated`. The desktop says how many followed in the
  status bar, and the rename panel says so before it happens.
- Only a link the rename actually strands is edited: a target that still reaches the note afterwards -
  an alias in its frontmatter, say - is the author's wording and is left alone, and so are links
  inside a code fence or inline code, which the graph does not read as links either. The link
  resolver and the rewrite are `linkResolver()` and `rewriteLinks()` in `@lumos/vault-utils/graph`, so
  the rename asks the graph's own question instead of growing a second set of rules.
- 13 new tests: 12 in `@lumos/vault-utils` (the resolver's names, the rewrite of a title, a
  filename, a markdown link and an embed, headings and aliases surviving, code left alone, and the
  rename carrying a link while leaving an alias link as written) and 1 in the daemon (the route
  answering the file it edited). The desktop's rename panel test now asserts the links-follow
  sentence. Suite is 447: 185 in `@lumos/vault-utils`, 125 in the daemon, 137 in the desktop.

### Added (continued 27)
- A brand identity: the Lumos mark is a lamp seen from above - a ring, three spokes and a lit centre -
  in the warm amber the name suggests. It sits beside the wordmark in the sidebar, in the browser tab,
  and on the Tauri window, taskbar and installer icons, which are now generated from one 512px source
  instead of shipping Tauri's default logo.
- `assets/` holds the source SVGs (`lumos-mark.svg`, `lumos-app-icon.svg`, the light and dark
  lockups), and the root README opens with the lockup on its own dark tile so it reads in either
  GitHub theme. The two app READMEs carry the mark.
- The sidebar does not import a file: `LumosMark` draws the mark inline in `currentColor` and takes
  its amber from a new `--color-brand` token, so no component hardcodes a hue and the mark follows
  the theme like everything else. It is the only warm colour in the shell - no button, border or state
  borrows it.
- 1 new test: the sidebar shows the mark beside the wordmark and hides it from assistive tech, which
  the wordmark already names. Suite is 448: 185 in `@lumos/vault-utils`, 125 in the daemon, 138 in
  the desktop.

### Added (continued 28)
- A delete can be taken back. `DELETE /note` no longer removes the file: it moves the note to
  `.trash/<id>/<folder>/<name>` inside the vault and answers the entry (`id`, `folder`, `name`,
  `deleted`). The status bar then offers **Undo** beside the notice; pressing it calls the new
  `POST /note/restore`, which puts the note back under its old name and opens it again.
- `restoreNote()` takes only the entry id, because the entry already remembers where the note lived -
  an undo cannot be aimed at another note. A name that has been taken again while the note was away
  is a `409`, the trashed copy stays put, and the entry is removed only once the file is home, so an
  id works once.
- The trash is a dot-folder, so the listings, the folder counts and the graph skip it without a rule
  of their own, and a trashed note is still a plain Markdown file a person can open in a file
  manager. Nothing prunes it: that, and the missing "empty trash", are the new entries in
  `docs/LIMITATIONS.md`.
- 13 new tests: 6 in `@lumos/vault-utils` (the entry and its bytes, two deletes in one millisecond,
  the trash staying out of the listing and the graph, a refused delete writing no entry, the restore
  with its cleanup, a name taken again, a missing entry and an id that could leave the trash), 4 in
  the daemon (the delete's answer, the restore, the `409`, and the `400`/`404`) and 3 in the desktop
  (the status bar's notice, its action, and a notice that offers none). Suite is 461: 191 in
  `@lumos/vault-utils`, 129 in the daemon, 141 in the desktop.

### Added (continued 29)
- A note's tags and status can be changed from the app. The strip under the note header
  (`src/components/NoteMeta.tsx`) shows each tag as a chip with an **×**, adds a tag from a field, and
  picks a status (`new`, `active`, `done`, `archived`). Until now a tag could only arrive from a
  WhatsApp hashtag, even though the filters, the graph and the palette all read them.
- `PATCH /note/meta` and `updateNoteMeta()` write only the frontmatter block, so the body is
  byte-identical afterwards. The block is parsed as the file has it rather than through `parseNote`,
  so a key another tool wrote survives an edit; the tags are cleaned the way the graph reads them (no
  `#`, lower-case, de-duplicated), so a tag typed here and a node on the canvas cannot disagree.
- A block that does not parse is refused (`400`) rather than replaced, because rewriting broken YAML
  would throw away what the person wrote. The block *is* re-serialised, so a comment or a hand-chosen
  key order inside it is not kept - a trade now written into `docs/LIMITATIONS.md`.
- 17 new tests: 7 in `@lumos/vault-utils`, 4 in the daemon, 5 in the desktop. Suite is 477: 198 in
  `@lumos/vault-utils`, 133 in the daemon, 146 in the desktop.

### Added (continued 30)
- The note editor now shows a live preview beside the textarea. Until now a saved note was the first
  chance to see whether a table parsed or a fence swallowed the rest of the body; the draft is
  rendered as it is typed instead. It is the same renderer the reader uses (`Markdown` in
  `src/components/Markdown.tsx`), so one pipeline decides headings, GFM, highlighting and the
  external-link override for both - a second renderer would be a second set of rules, and a preview
  that disagrees with the saved note is worse than none.
- **Hide preview** / **Preview** gives the textarea the whole pane and brings the rendering back; the
  button carries `aria-pressed`. The panes scroll on their own - they are read for different things,
  so there is no scroll sync - an empty draft says "Nothing to preview yet." rather than showing a
  blank pane, and below the `md` breakpoint the two stack instead of squeezing prose into half a
  column.
- The preview is a rendering of the draft, never a source of truth: nothing is saved from it, and it
  leaves with the draft. The cost is a redraw per keystroke, which is written into
  `docs/LIMITATIONS.md` along with the fact that a very large note will feel it.
- 3 new tests in `src/components/NoteEditor.test.tsx` (the rendering follows the typing, the toggle
  hides and restores the pane with its state, and the empty draft says so). Suite is 480: 198 in
  `@lumos/vault-utils`, 133 in the daemon, 149 in the desktop.

### Fixed
- The note viewer no longer makes React warn about duplicate keys. Its three per-file children -
  the tag strip, the actions panel and the editor - were all keyed on the note's own path, so
  opening the editor (or the actions panel) put two siblings on one key. Each keeps the per-file
  reset that stops one note's half-typed state landing in another, but now under a prefix of its
  own (`meta-`, `actions-`, `editor-`). 3 tests in `src/components/NoteViewer.keys.test.tsx` render
  the note as it is read, with the editor open and with the actions panel open, and assert React
  says nothing; suite is 483: 198 in `@lumos/vault-utils`, 133 in the daemon, 152 in the desktop.

### Added (continued 31)
- An E2E smoke test, closing the Phase 0.1 enforcement gap: the components were covered in jsdom,
  but nothing proved the *built* bundle reached the daemon or that the Markdown, highlighting and
  keyboard wiring survived bundling. A new `e2e/` workspace runs Playwright against a real Chromium,
  starting the daemon on port 3101 over a committed fixture vault (`e2e/fixtures/`) and the desktop
  built with `VITE_DAEMON_URL` pointing at it, served by `vite preview` on 4173. Neither server is
  reused if already running, so a daemon left over from another session cannot be silently tested
  instead of this one.
- 5 tests in `e2e/smoke.spec.ts`: the vault loads through the daemon (not the demo fallback), a
  second note opens with its Markdown and a highlighted `language-js` fence, a backlink is listed
  and followed, a tag chip narrows the list and puts it back, and `Ctrl+K` then `Enter` finds a note
  by body text. Every test fails on any uncaught page error, so a crash cannot read as a pass.
- `pnpm test:e2e` runs it from the root; CI runs it as a second job in
  `.github/workflows/validate.yml`, because it needs a browser binary and its own build. It is not
  part of `pre-push`, so a contributor is never blocked on a browser download. `oxlint` now lints
  `e2e` too, and `e2e` is a workspace package so `pnpm typecheck` covers it.

### Added (continued 10)
- A trash you can look through, not just undo. A delete's **Undo** only lives as long as its notice,
  and the next notice replaces it, so the **Trash** tab in the sidebar lists every note a delete kept:
  `GET /trash` answers them newest first with the folder and time each went, and `listTrash()` reads
  them back from `.trash`. Each entry offers **Restore**, which puts the note back under the name it
  had and opens it again, keeping the entry when a note has taken that name in the meantime.
- **Empty the trash**, the one command in the daemon with no undo. It takes two presses in the app -
  the button, then a confirm that names the cost and offers **Keep them** - before `DELETE /trash`
  removes every entry and answers how many went; the panel closes once it lands, because an empty
  list is not worth a pane of its own. A trash someone half-cleaned by hand is skipped rather than
  refusing the rest, and emptying an empty trash is a success rather than a `404`. What that costs is
  named in [LIMITATIONS.md](docs/LIMITATIONS.md): a local-first vault has no second copy to fall
  back on, and the links those notes carried go with them - the graph drops the edge rather than
  resurrecting a note to keep a link tidy.

### Added (continued 11)
- The link pane reads a PDF. `GET /link` refused anything that was not HTML, XHTML or plain text,
  with its content type named, so a paper or a report was a dead end in the reader. The daemon now
  parses `application/pdf` and answers the same card as a page - the document's text, capped like
  any page at 6,000 characters, with the file name as the title - and a file served as
  `application/octet-stream` is judged by its first bytes instead of the header that said nothing:
  a PDF by its `%PDF-` magic, a page by its doctype. Everything else (video, JSON, archives) is
  still refused and named before its body is downloaded. This adds the first parser dependency to
  the daemon (`unpdf`, wrapping pdf.js for serverless use); a page's fetch cap stays 1 MiB and a
  PDF's is 10 MiB. What that still cannot read - a scan with no text layer, an encrypted file,
  text drawn outside the page box - is written down in
  [LIMITATIONS.md](docs/LIMITATIONS.md).

### Added (continued 12)

- `/plan today | tomorrow`, the last open daemon item. The command has been parsed since Phase 3
  and answered "isn't built yet"; it now reads the vault's 20 newest notes into a prompt and asks
  the local Ollama model for at most five short points, dated with the machine's own day. An empty
  vault is answered without a request at all, and every way the model can be missing says one
  actionable thing: which address is not answering and the command to start it, which model is not
  pulled and the command to pull it, a timeout, a status, or an unreadable answer. The socket's own
  words (addresses, errnos) never reach the reply, and the prompt - built from note contents - is
  never logged. `ollamaUrl`/`ollamaModel` join the config file (`OLLAMA_URL`/`OLLAMA_MODEL` in the
  environment), defaulting to `127.0.0.1:11434` and `llama3.2:3b` - the model question this plan had
  left open. No client library: one `POST /api/generate` over `fetch` did not justify one, the same
  call the link scraper was made on.

### Added (continued 13)

- TanStack Router, the Phase 4 item the plan had kept open. The desktop has one route at `/` whose
  typed, validated search parameters carry which pane is open (`?view=notes|graph|trash`) and which
  note (`?note=Folder/name.md`), so a reload, the back button and a pasted link all land on the
  same place. The notes pane is the plain address, an unknown view value falls back to it, and a
  delete drops the deleted note's parameter. The path itself never changes, which is what keeps the
  whole thing safe inside a Tauri window, where there is no server to fall back on. Everything
  else - filters, notices, the pane widths - stays ordinary React state: the address carries only
  "where you are". Six routing tests render the real shell through the router (`App.routing.test.tsx`),
  the 162 existing desktop tests were untouched and stay green, and the five e2e smoke tests pass
  against the built bundle.

### Added (continued 14)

- A vault store, the last Phase 4 item. What the whole shell shares - the daemon read with its
  demo fallback, the re-read after every save or rename or move, and the list's filters (folder,
  query, tag) - moved out of `App`'s eight `useState` slices and two hand-rolled triple-reads into
  one zustand store (`src/lib/store.ts`), so every change re-reads the vault through the same
  action instead of three near-copies of it. A failed re-read throws rather than speaking for
  itself: the caller turns it into the status-bar notice, the one place that talks to the person.
  The pane and the open note stay in the address (TanStack Router), and session-only UI state
  stays in the component - the store holds only what more than one place reads or re-reads. Eight
  store tests were written red first, covering the demo fallback, a graph failing on its own and
  a re-read that throws; the routing test resets the store per case so a singleton cannot leak a
  vault between tests.

### Added (continued 15)

- Bulk operations, the Phase 7 item. A checkbox per row in the note list chooses several notes;
  with the first selection a bar appears - the count, a folder picker to move them, a tag field to
  add one, Archive, and Clear. Archive sets the note's existing `status: archived`, so the vault
  gained no new concept. Each note's write is settled on its own (`lib/bulk.ts`): a refusal on one
  note never abandons the rest, and the status bar says what landed plus the first refusal in the
  daemon's own words - the same sentences a single-note operation speaks. Leaving the notes pane
  drops the selection, so a bulk action can never fire at notes the person is no longer looking
  at. Six helper tests and three end-to-end through the real shell, written red first.

### Added (continued 16)

- Subtle transitions, the first Phase 8 item. A pane switched to - the note list and viewer, the
  graph, the trash - the search palette, the bulk bar and a status-bar notice each enter with one
  short fade or slide-down instead of appearing mid-frame, so a switch reads as a change of place
  rather than a jump. Both keyframes sit behind `prefers-reduced-motion: no-preference`, so a
  system that asks for less motion gets none; there is no new dependency, only plain CSS beside
  the tokens it already uses.

### Added (continued 17)

- List virtualization, the second Phase 8 item. Above 50 notes the list windows itself: only the
  rows on screen (plus a small overscan) are in the DOM, each measuring itself as it renders, so
  a keystroke in the search above no longer re-renders every row of a large vault. Below 50 notes
  nothing changed - the rows are exactly as they were, which is also why every existing component
  test kept passing untouched. One new dependency: `@tanstack/react-virtual`, headless, from the
  same family as the router.

### Changed (continued)

- The daemon answers `GET /notes/search` from a warm index instead of re-reading the vault on every
  query, the third Phase 8 item. The palette asks on every pause in typing, and each query read
  every note file twice - once for the listing, once for the bodies. Bodies are now kept in memory
  and re-read only when a file's mtime or size moves, and a note that leaves the vault loses its
  entry. Measured over 600 notes (1.9 MB): 350-446 ms per query before, 184-185 ms warm. The
  listing is still read fresh, so a note the phone just wrote is found immediately.

### Added (continued 18)

- `USAGE.md`, the fourth Phase 8 item: a standalone guide to using Lumos rather than building it.
  The two halves and how to start each, what a WhatsApp message becomes (title, filename, tags,
  frontmatter), the vault's layout, and the desktop app end to end - finding, reading, writing, bulk
  actions, the graph, the panes and the keys - plus the HTTP API with runnable requests, every
  setting, and a troubleshooting table of the messages the app and the daemon actually print. The
  README links it, and the README keeps the tour rather than the reference.

### Changed (continued 2)

- The brand mark is redrawn: a wand throwing a four-point spark, with three rays ending in nodes,
  replacing the ring-and-spokes lamp. It lands everywhere the old mark was - the sidebar (still
  inline in `currentColor`, so it keeps taking `--color-brand`), the browser tab, the window,
  taskbar and installer icons (regenerated from one 512 tile with `tauri icon`), and the four SVGs
  in `assets/`. The light wordmark is the same geometry recoloured for white: ink text, amber
  darkened to `#C77F00`, no glow. The embedded C2PA provenance block the artwork arrived with is
  stripped from every asset, so the files hold nothing but the drawing.

### Added (continued 19)

- Screenshots in the docs, the last Phase 8 item: `docs/images/` holds the notes view with its
  backlinks, the search palette with a result marked as matching only inside the body, and the graph.
  They were taken with Playwright against the running app over a throwaway eight-note vault, so no
  personal note is in any of them, and the README and `USAGE.md` both use them.

### Added (continued 32)

- Folders you make. `Folder` was a union of five names and the five were compiled into the daemon,
  the app and the graph palette; it is now just "a directory in the vault", read from disk. A new
  `Movies` folder answers to `/movies <link>` on WhatsApp the moment it exists, `To Read` to
  `/to-read`, and the four documented shorthands (`/idea`, `/interview`, `/goal`, `/read`) still
  work. `/newfolder <name>` makes one from the chat, **+ New folder** in the desktop sidebar does the
  same through a new `POST /folders`, and every folder-checking route asks the vault instead of a
  constant, so a folder made a second ago is accepted rather than refused as unknown. The sidebar,
  composer, move menus, bulk move and graph legend all read that one list, so a folder made on the
  phone is a destination in the app without a restart.
- A bare `/` answers with the menu. WhatsApp has no slash-command autocomplete inside a chat, so the
  command list is one keystroke away: `/` replies with one line per folder, built from the folders on
  disk, plus `/newfolder`, `/plan`, `/find` and `/help`. The limit itself is recorded in
  `docs/LIMITATIONS.md` - the chat cannot suggest a command while you type, and this is the
  substitute rather than a fix.

### Fixed

- The desktop status bar's QR button opened `http://127.0.0.1:3001/qrcode`, which the daemon did not
  serve: pairing only ever printed the code in the terminal, so the button was a 404 and the docs
  described a page that did not exist. `GET /qrcode` is real now - the code the socket is waiting
  for, drawn as half-block text so a phone can scan it from the app, refreshing itself every ten
  seconds because the code rotates, and never cached. With nothing to pair it answers with the
  sentence that says which (already linked, or capture switched off). The button also showed itself
  when the daemon was unreachable, which is when the page cannot load; it now shows while the daemon
  answers and reads **Pair**.

### Changed (continued 3)

- The repository works on one branch, `main`, instead of a short-lived branch per change. Commits land
  there and are pushed there; the `pre-commit` hook no longer refuses a commit on `main`, and the one
  rule that replaces the merge review is that a commit holds one topic, so `git revert <sha>` can
  take it back on its own. `RULES.md` §6 was rewritten around the loop (pull, work, `pnpm validate`,
  commit, push) and what the trade-off gave up - a review step in front of `main`, with CI reporting
  on the push rather than blocking it - is recorded in `docs/LIMITATIONS.md`. `AGENTS.md`,
  `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md`,
  `docs/PLAN.md` and `docs/roadmap.md` follow the same change, and the three branches that were
  still open were merged into `main` and deleted.
