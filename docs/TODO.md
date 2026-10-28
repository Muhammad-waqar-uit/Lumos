# Lumos - Master TODO

The checklist, ordered by where each item actually stands: the checks only a person can make, then
what is planned, then what is in flight, then what is done. The phase a piece of work belongs to
stays on the item, so the phases in [`PLAN.md`](PLAN.md) still map onto it.

**Legend:** `[!]` needs a manual check by a person · `[ ]` todo · `[~]` in progress · `[x]` done ·
Priority: P0 critical, P1 high, P2 medium, P3 low

## Needs your testing

Six checks that no unit test can close: each needs a device, a real window, a pointer or a client
that has to be signed in. They are first because they are the shortest path to knowing the app works
end to end, and because nothing else on this page can close them.

- [!] **The Tauri shell and one-click Windows package** (P1) - install the generated NSIS setup,
  launch Lumos from Start, confirm the daemon comes online and WhatsApp shows a pairing code, pair
  the phone, send a message, then exit and confirm the daemon child stops. `cargo check` passes in
  debug and release; live packaging and a linked WhatsApp session still need a Windows manual check.
- [!] **A live WhatsApp session** (P1) - pair a device with the QR code and send a real message, so
  the capture path is checked against the platform rather than against a parser and a stub.
- [!] **The social embeds and in-app link viewer inside the packaged window** (P2) - a reel, a video
  and a post were verified in Chromium, which is not the packaged webview engine. Confirm that the
  separate link window opens ordinary pages, follows redirects/links within HTTP(S), and refuses
  navigation to other schemes in the Tauri shell.
- [!] **The graph's "Show notes" button** (P2) - the wiring is now tested end to end at the
  component level (`GraphView.test.tsx` asserts that selecting a tag node offers **Show notes** and
  passes the tag to the filter), but a real pointer still has to hit a node drawn on a canvas, and
  no jsdom test can place that hit.
- [!] **Scanning the pairing code** (P2) - `GET /qrcode` and the desktop panel are tested for what
  they draw (half-block text, no colour codes, equal line widths) but not for whether a phone camera
  reads it. The polarity is the risky part: `qrcode-terminal` draws light modules as blocks, so both
  surfaces are light-on-dark. Scan it once from the panel with a real phone, then press **Disconnect**
  and **Connect** and check the link comes back without a code - the pause is unit-tested through an
  injected bridge, but the socket it pauses is not.
- [!] **A real Claude Code session with the MCP server** (P1) - `claude mcp add --scope user lumos
  -- pnpm --dir <repo>/apps/mcp start`, then `claude mcp list` shows it connected, `/mcp` lists the
  twelve tools, and a request in your own words lands in the vault. The protocol is covered over the
  SDK's in-memory transport and the entry point is spawned over a real stdio pipe, but nothing signs
  the server into a client and lets an agent choose the tools itself - which is the part worth
  watching, because a tool description that reads well to a person can still lead a model to the
  wrong call. Check too that the client sees the vault you meant when `LUMOS_VAULT` is set.

## Plan

### Phase 4 - Desktop UI foundation (P0) - open items

- [x] TanStack Router setup - the pane and the open note are `?view=` and `?note=` on the one `/`
  route, so a reload, the back button and a pasted link all land on the same place; an unknown
  view value falls back to the notes pane (`src/router.tsx`, `App.routing.test.tsx`)
- [x] zustand state management - the vault index and the list's filters live in `src/lib/store.ts`;
  the pane and the open note stay in the address, and session-only UI state stays in the
  component (`store.test.ts`)

### Phase 7 - Editing & enrichment (P2) - open items

- [x] The WhatsApp link in the app - `GET /whatsapp` reports the state, when it began, when a
  message was last answered (`lastAt`, the only field that says the loop ran) and why it is down;
  `POST /whatsapp/connect` and `/whatsapp/disconnect` drive it, and the pairing code is drawn in the
  panel instead of a browser tab. The shell opens the panel automatically when a pairing QR first
  arrives, and `Cmd/Ctrl+K` and the light/dark toggle are covered at the whole-shell level.
  The state lives in `bridge.ts` between the socket and the routes, so `connected` means a socket is
  up rather than "a message once arrived". Disconnect keeps the phone linked - unlinking stays on
  the phone, which is the one thing nothing here can do - and the app is told `logged-out` when it
  happens

- [x] Commands in the palette - New note, New folder (named in the palette itself), Open the graph,
  Open the trash. The composer's open state moved from the list to the shell for it, because two
  places can now open it
- [x] Live capture - a note written by WhatsApp appears in an open window within one poll, named in
  the status bar with **Open** (or counted, with **Open newest**). The trigger is the link's `lastAt`,
  so an edit made in another editor still needs a read; that limit is in
  [LIMITATIONS.md](LIMITATIONS.md)

- [x] Bulk operations (move, tag, archive) - checkboxes in the list choose notes, a bulk bar offers
  move/tag/archive/clear, and every write is settled on its own so one refusal never abandons the
  rest (`lib/bulk.ts`, `App.bulk.test.tsx`)
- [x] Rename or remove a folder - `PATCH /folder` and `DELETE /folder`, plus `/renamefolder
  <from>|<to>` and `/delfolder <name>` on WhatsApp. Removing moves the notes to Inbox rather than
  deleting them: a folder is only a place to file things, so removing one must never take a note
  with it, and the reply says how many moved. A rename is one `rename` on disk - every note keeps
  its filename and date - and the links that *named the folder* are rewritten in the notes that
  carried them (`folderPathEdits()`), because a link by title or bare filename still resolves after
  either change and is the author's wording rather than a stale path. Every name is checked against
  the destination before anything moves, so a refusal changes nothing. In the sidebar the two
  controls sit on the folder the list is looking at, behind a confirm that names the consequence

### Phase 8 - Polish & docs (P2) - open items

- [x] Subtle transitions - a pane switched to, the palette, the bulk bar and a notice each enter
  with one soft fade (`fade-in`/`slide-down` in `index.css`), and none of it runs for
  `prefers-reduced-motion`
- [x] List virtualization - above 50 notes the list windows itself (`VIRTUALIZE_ABOVE` in
  `NoteList.tsx`, `@tanstack/react-virtual`); below that, every row is simply rendered as before
- [x] A daemon-side search index - `createNoteSearch` in `@lumos/vault-utils`, one per daemon,
  keeps a body's lowercased text against the file's mtime and size and re-reads it only when
  either moves; a repeated query was 350-446 ms → 184-185 ms over 600 notes
- [x] Screenshots in the docs - three in `docs/images/`, taken with Playwright against the running
  desktop on a throwaway vault (the browser panel's own overlay would have been in the frame): the
  notes view with backlinks, the palette with a body-only match, and the graph
- [x] `USAGE.md` - a standalone guide: the two halves and how to start each, capture from WhatsApp and
  what happens to a message, the vault layout and frontmatter, the desktop app end to end (finding,
  reading, writing, bulk, graph, panes, keys), the HTTP API, settings, and a troubleshooting table
  of the messages the app and the daemon actually print

### Phase 10 - Explainers (P3) - open items

Steppable, animated explanations, from one scene to two audiences: SVG frames for a person, a
per-step text form and trace for an agent. Shape, cost and the drop conditions are in
[explainers.md](explainers.md); nothing below is built.

- [ ] The spike, one afternoon - vendor [lantern](https://github.com/ivarvong/lantern) at a pinned
  commit (MIT notice kept) or pin it as a git dependency, compile it with its own library build,
  render the capture-pipeline scene to SVG in Node 24, and **measure** the compiled size, one
  frame's size and the render time. Then read the frames at phone width and at desktop width. This
  item exists to replace the guesses in [explainers.md](explainers.md) with numbers
- [ ] The decision, after the spike - docs only (keep), in-app (start the panel), or drop it. Record
  it in the PLAN decisions log and put the measured numbers in [explainers.md](explainers.md)
- [ ] The first docs explainer - **a message becomes a note**: the message, the allowlist, the
  parse, the folder, the file, the reply, one step each. Rendered at build time into committed SVG
  under `docs/images/explainers/` and embedded in [ARCHITECTURE.md](ARCHITECTURE.md), so no
  dependency reaches the desktop bundle
- [ ] The second docs explainer - **what an MCP tool call touches**: client, server,
  `@lumos/vault-utils`, the file, and the branch where a bad key is refused before any file is
  opened. It is the safety claim in [mcp.md](mcp.md) drawn instead of asserted
- [ ] An "Explain" panel in the app (P3) - a note or a graph cluster walked through one step at a
  time: this note, what it links to, what it is not connected to, with the same scene answerable as
  text over MCP. **Only after the spike**: it puts a second rendering model beside the canvas force
  graph, which is a cost that has to be justified by the docs slice working first

## In progress

Nothing in flight. The next item to pick up is the first one under **Plan**. Future profile
extensions to keep in view are recorded in [FEATURES.md](FEATURES.md): export/import or vault-portable
preferences, optional sections/themes, and a privacy-reviewed account/public identity only if
sharing is added. These are reminders, not commitments or requirements for the current profile.

## Done

### Phase 0: Enforcement & Workflow (P0)

- [x] oxlint as the linter (kept in step with the TypeScript version), prettier as the formatter
- [x] Husky hooks: `pre-commit` (lint-staged), `commit-msg` (commitlint), `pre-push` (`pnpm validate`)
- [x] Root scripts: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `build`, `validate`
- [x] The hooks enforce the workflow rather than describing it - commitlint on the message,
  `pre-push` on the gate. The `pre-commit` guard that refused to commit on `main` was removed on
  2026-10-25, when the repository moved to a single branch
- [x] `pnpm validate` = lint + format:check + docs:check + typecheck + test + counts:check + build
- [x] Test counts in the docs can no longer drift (2026-10-26) - every `pnpm test` writes a JSON
  report beside its package, `docs/TESTING.md` is generated from those reports
  (`pnpm counts:update`), and the gate fails when the committed table no longer matches a run
  (`scripts/gen-test-counts.mjs`). The claims in the README and FEATURES now link to the table
  instead of restating numbers, so there is one place a count can live
- [x] One TypeScript version (`~6.0.3`) across every workspace, with a `typecheck` script in each
- [x] `RULES.md` (build / commit / branch standards), `AGENTS.md` (agent working agreement), `CLAUDE.md`
- [x] Workflow in writing: one branch (`main`), one topic per commit, rewritten 2026-10-25. The
  short-lived `<type>/<description>` branch + PR model it replaced is in git history
- [x] Generated Tauri schemas excluded from formatting; prettier clean across the repo

### Phase 0.1: Enforcement (P1)

- [x] GitHub Actions workflow (`.github/workflows/validate.yml`) running `pnpm validate` on every PR
  into `main` and every push to `main`
- [x] Branch protection on `main`: required a pull request and both CI checks (`pnpm validate` and
  `pnpm test:e2e`), with `strict` on so a stale branch could not merge; force pushes and deletions
  blocked (validate on since 2026-10-19, first run on `main` green in `38790615355`; e2e added with
  the Playwright suite). Superseded 2026-10-25: work lands on `main` directly, so the blocking gate
  is now the local `pre-push` hook and CI reports on the push
- [x] Test runner (vitest) wired up and added to the validation gate - 223 tests over
  `@lumos/vault-utils` and the daemon, plus 108 over the desktop (filtering, demo data, search
  ranking, recent notes, the link cache, list movement, pane widths, graph layout memory, the
  viewer's code highlighting, and the sidebar, note list, search palette and link pane as
  components and composer), so 391 in `pnpm validate`
- [x] The graph view's React layer is covered (2026-10-26) - `GraphView.test.tsx` renders the
  component against a recorded stand-in for the renderer and asserts what the canvas is *told*:
  the Tags and Unlinked controls and the depth slider decide the node ids handed over, a note node
  selects and **Open note** carries its id, a tag node offers **Show notes** carrying the tag, and
  the counts line, the folder legend, the loading and empty states and the live/demo/connecting
  wording all render. The pixels are not asserted - force-graph draws them - so the pointer-hit
  item under **Needs your testing** stays open
- [x] Desktop component tests - jsdom + Testing Library (`@testing-library/react`, jsdom) over the
  six components that carry state, each file declaring its own `jsdom` environment so the pure-logic
  suites stay in Node. They assert behaviour rather than markup: the active folder and view, the
  loading/empty/tag-empty states, a row opening its note, a broken note's badge and reasons, a tag
  chip switching a filter on and off, the palette's recent notes and Enter/Escape, the link
  pane's embeds, reader states and a **Retry** that really asks again, the editor's draft, its
  failed save keeping the text, `Cmd/Ctrl+S`, and a second click while the first save is in flight,
  and the composer's folder list, its failed create keeping the text, and `Cmd/Ctrl+Enter`
- [x] An E2E smoke test - the Phase 0.1 gap closed. A new `e2e/` workspace runs Playwright against a
  real Chromium: the daemon on port 3101 over a committed fixture vault, the desktop built with
  `VITE_DAEMON_URL` pointing at it and served by `vite preview`. 5 tests in `e2e/smoke.spec.ts`
  drive the **built** bundle - vault loads through the daemon, a note opens with its Markdown and a
  highlighted fence, a backlink is followed, a tag chip filters, `Ctrl+K`/`Enter` finds a body
  match - and every test fails on an uncaught page error. `e2e/layout.spec.ts` adds the two
  measurements jsdom cannot make: no overflow and a usable viewer at the window's 860x560 minimum,
  and the insights grids taking two columns in a 436px pane where a viewport rule would ask for
  three. `pnpm test:e2e` runs it; CI runs it as a
  second job in `.github/workflows/validate.yml`. It is not in `pre-push`, so a contributor is never
  blocked on a browser download
- [x] Schema validation for note frontmatter - `validateFrontmatter()` in `@lumos/vault-utils`
  checks the fields the app relies on and the problems travel with the note (`Note.problems`,
  `VaultEntry.problems`) instead of the file being skipped. It runs when a note is read, and the
  rules are pinned by unit tests inside the gate; the vault itself is git-ignored, so CI can only
  validate fixtures, never a user's notes
- [x] Route tests for the read API - `createApp()` in `app.ts` builds the Fastify app over a vault
  directory, so `app.inject()` covers `/health`, `/message`, `/notes`, `/notes/search`, `/folders`,
  `/note` (every guard), `/graph`, `/link` and CORS without binding a port, and with the link
  fetcher injected so the suite stays offline. `PUT /note` and the `OPTIONS` preflight a browser
  sends before it were added with the editor - the preflight one caught a real bug (`@fastify/cors`
  defaults to `GET,HEAD,POST`, so a `PUT` was refused in the browser while `curl` worked)

### Phase 1: Documentation & Tracking Foundation (P0)

- [x] Create `PLAN.md`
- [x] Create `TODO.md`
- [x] Create `PROGRESS.md`
- [x] Create `FEATURES.md`
- [x] Create `ARCHITECTURE.md`
- [x] Create `CONTRIBUTING.md`
- [x] Create `CHANGELOG.md`
- [x] Create `docs/daemon.md`
- [x] Create `docs/desktop.md`
- [x] Create `docs/vault.md`
- [x] Create `docs/design.md`
- [x] Create `docs/roadmap.md`
- [x] Update `README.md` with doc links
- [x] Move all docs into `docs/` (keeping `CHANGELOG.md` and `CONTRIBUTING.md` at root for GitHub
  conventions)
- [x] Link check over README + `docs/*.md` after every move

### Phase 2: Shared Packages (P0)

- [x] `packages/shared`: core types (Note, Frontmatter, Command, VaultEntry)
- [x] `packages/vault-utils`: vault ops (read/list/search/parse/write, slugify)
- [x] Configure pnpm workspace + tsconfig for packages
- [x] Refactor daemon to use shared packages

### Phase 3: Daemon enhancements (P1)

- [x] Read API for the desktop: `GET /notes`, `/notes/search`, `/folders`, `/note`, `/graph`
  (+ CORS, traversal guards)
- [x] Link expansion for `/read` and `/interview` (title, description, og:image, plus the readable
  text) - `GET /link`, with the guards and caps in `fetch-link.ts`
- [x] Implement `/find <query>` search over the vault (title, tags, body; 5 matches per reply)
- [x] Tag extraction: `#hashtags` in a captured message become the note's frontmatter tags, using
  the graph's own `extractTags()` rules (headings and code excluded, lower-cased, de-duplicated); no
  model, so it stays deterministic and offline
- [x] Folders you make - a folder is a directory, so the set is the vault's own: `/newfolder Movies`
  makes one and `/movies <link>` files into it, `POST /folders` does the same for the desktop's **+
  New folder**, and every folder-checking route asks the vault rather than a constant. The sidebar,
  composer, move menus and graph legend all read that one list (`listFolderNames()`), and a bare `/`
  answers with the menu built from it, since WhatsApp itself offers no command autocomplete
- [x] Config file support - `lumos.config.json` (`vaultPath`, `port`, `allowedNumbers`, `whatsapp`)
  with the environment overriding it, so a one-off `VAULT_PATH=... pnpm dev` still wins while the
  file stays the thing a person edits. A relative `vaultPath` resolves against the file, not the
  working directory; a missing file is not an error; an unknown key, a bad port or a malformed file
  stops the daemon with one sentence and exit 1 rather than starting on a guess; numbers are
  normalised however they were typed. `vault.ts` is gone - `config.ts` is the one place settings are
  decided (12 tests, and the process was run against a real file on a configured port)
- [x] One error handler on the Fastify app - the routes answer their own refusals with a sentence
  that names the cause, and anything they did not anticipate answers a plain
  `500 { "error": "The daemon could not finish that request." }`. The raw message is neither sent
  nor logged, because a Node error carries the absolute path it failed on and the vault path stays
  out of both; the log records the error's name and code against the request id instead. A `4xx`
  Fastify raised itself keeps its own message, so a malformed body still says what was wrong. Two
  route tests put a vault that is a file behind the app, so `GET /notes` fails for real
- [x] Error messages that name their own cause - a missing `text`, an unknown folder, an unsafe
  filename, a missing note, and the link fetcher's refusals (a scheme that is not http(s),
  credentials in the URL, a local or private address, too many redirects, an unreachable page, a
  content type that is not a page) each answer with a sentence a person can act on
- [x] Unit tests for the parser and the vault operations (vitest, `pnpm test`)
- [x] `/help` lists itself: the list it prints is the whole list, and a test pins every line in
  order, so a new or renamed command cannot leave it behind (found by the daemon tests)

### Phase 4: Desktop UI foundation (P0)

- [x] Tailwind CSS v4 + dark shadcn-style design tokens (near-black)
- [x] Core components (Sidebar, NoteList, NoteViewer, StatusBar, search input)
- [x] App shell layout: sidebar + note list + note viewer + status bar
- [x] Resizable panes - `PaneSplitter` between the list and the viewer: drag, double-click to
  reset, or focus it and use `←`/`→`/`Home`. A real `separator` with `aria-valuemin`/`max`/`now`;
  the 240-560px bounds and the clamping are `src/lib/pane-size.ts` (7 unit tests), the width lives
  in `App` so the Graph tab does not reset it

### Phase 5: Vault browser (P0)

- [x] Link pane: site chrome stripped harder - the reader drops whole `<pre>` code samples, the
  chrome elements (`header`, `footer`, `aside`, `nav`, `form`, `dialog`, `button`, `select`), a bare
  bracketed label like `[ edit ]`, a line the page repeats back-to-back, and the payload of a `data-`
  attribute. Measured through `GET /link` on MDN's `if...else` page: 37 code-ish lines and 32 repeats
  before, 0 and 0 after; Wikipedia now opens with its first sentence instead of its language sidebar
  and no longer leaks a template JSON blob (6 tests in `packages/vault-utils/src/link.test.ts`)

- [x] Sidebar with vault folders + note counts
- [x] Note list pane (sorted by date, preview, tags)
- [x] Vault load on mount via the daemon read API (demo fallback when offline)
- [x] Note viewer - Markdown rendering via `react-markdown` + `remark-gfm` (headings, lists, tables,
  task lists, blockquotes, fenced code; note links open externally)
- [x] Syntax highlighting for fenced code blocks - `rehype-highlight` over the 37 common languages,
  only for a fence that names one (an untagged or unknown fence stays plain rather than being
  guessed at), with the token colours added to `src/index.css` instead of importing a theme file; 3
  render tests cover the three cases
- [x] Tag filtering: the note list offers the tags in the current folder and query as chips with
  counts, a chip filters to that tag and toggles off, a note's own tag is the same control, and the
  active tag survives a folder change (`src/lib/filter.ts`, 12 unit tests)
- [x] Graph view: canvas link graph from `GET /graph` - glow nodes sized by backlinks, curved edges,
  one hue per folder, tag and unlinked filters, local depth around the open note, demo graph offline
- [x] Graph: backlinks panel in the note viewer, fed by the same extracted links - `backlinks()` in
  `@lumos/vault-utils/graph` returns the notes whose *links* point at the open one (a shared tag is
  a neighbour, not a backlink), and the viewer lists them as buttons that open the note; offline it
  reads the demo graph, so it works with the daemon stopped (5 unit tests)
- [x] Graph: tag nodes are drawn in the tag hue and sized separately, and selecting one offers
  **Show notes**, which switches to the notes view filtered to that tag
- [x] Graph: node positions survive a tab switch - the coordinates and a camera the user placed are
  kept in `src/lib/graph-layout.ts` (module scope, so the unmount that a tab switch causes does not
  lose them), seeded back into the nodes on mount, and pruned when a note leaves the vault (12 unit
  tests)
- [x] Graph: re-fit after the pane is resized - a resize refits so the graph cannot sit off-centre;
  a view the user panned or zoomed is preserved instead, because that is theirs to keep
- [x] Link pane: a note's link plays (YouTube/Vimeo), shows as an image, or scrapes into a reader
  card with loading, error and retry states
- [x] Link pane: an Instagram reel/post and a Facebook video/post render in place through the
  host's own embed, with the caption card from `/link` under it and a frame shape per kind
  (portrait, 16:9, tall)
- [x] Link pane: keep a scraped page for the session instead of refetching it every time the note is
  reopened - `src/lib/link-cache.ts` holds the card by URL at module scope and joins a second caller
  onto the request already in flight, so a remount, a tab switch and StrictMode's double mount cost
  one read; a refusal is not cached, so Retry still works (7 unit tests)

### Phase 6: Search & Discovery (P1)

- [x] Vault insights (the **Stats** tab) - the one "Beyond" idea that needed no new data, since the
  shell already loads the listing and the graph: notes, folders, tags, resolved and unresolved
  links, notes added this week and this month, the most-linked notes, the notes with no links or
  tags, the commonest tags and the size of each folder, each row a way in rather than a number with
  nothing behind it. Computed from what the window holds, so it opens with no request and works
  offline; a graph that did not answer is said to be missing instead of counted as zero
  (`@lumos/vault-utils/insights`, `InsightsView.tsx`, `?view=insights`; the MCP server reuses it as `vault_health` and the daemon as `GET /stats`)
- [x] A **Profile** pane (the avatar at the top of the sidebar, `?view=profile`) - up to six pinned
  notes as cards, a year calendar of one square per day with absolute amber bands (one note is the
  lightest step; scaling to the busiest day would paint a quiet vault as brightly as a busy one), a
  year picker over every year holding a note, and the current streak, longest run, active days and
  busiest day, counted across years and not broken by today being unfinished. The name and one line
  the vault gives itself travel to the avatar in the sidebar. Preferences live in `localStorage`
  rather than in the vault, which stays plain Markdown any editor can read; the calendar arithmetic
  is `vaultActivity()` in `@lumos/vault-utils/profile`, pure and clock-injected. The pane is the
  keyboard's too - **Open the profile** in the palette, since a pane added without a command would
  be the one place the keyboard cannot reach (`src/lib/profile.ts`, `ProfileView.tsx`; 20 tests)
- [x] In-app link viewer: the page reader's full-page, host and image actions open a separate
  capability-isolated Tauri webview on desktop. Only credential-free HTTP(S) URLs are accepted and
  later navigations are kept to HTTP(S); the Vite preview opens a browser tab. This is a system
  webview, not a bundled Chrome engine (`src/lib/link-viewer.ts`, `src-tauri/src/lib.rs`)
- [x] Full-text search with fuse.js - the palette ranks titles, tags and previews over the loaded
  vault, tolerant of typos, and works with the daemon stopped (`src/lib/search.ts`, 10 unit tests)
- [x] Cmd/Ctrl+K search modal - opens from anywhere, including while a text input has focus; arrows
  move the selection, Enter opens the note in the Notes view, Esc closes and focus goes back. The
  status bar carries a Search button with the shortcut beside it, so the key is discoverable too
- [x] Light/dark theme toggle - the Moon/Sun control changes the shared token palette across the
  app, saves `light`/`dark` locally and accepts legacy JSON-quoted preferences (`ThemeToggle.tsx`,
  `index.css`; both directions and persistence covered by the shell test)

- [x] Recent notes quick access - an empty palette lists the notes opened this session, newest
  first, up to five, with `↑`/`↓`/`Enter` working on them; the keys resolve against the live
  listing, so a deleted note disappears instead of leaving a dead row (`src/lib/recent.ts`, 10 unit
  tests)
- [x] Share search logic with daemon `/find` - the palette sends the same query to
  `GET /notes/search`, which calls `searchNotes` the way `/find` does, so body matches come from
  one implementation rather than a second index

### Phase 7: Editing & Enrichment (P2)

- [x] Link metadata enrichment + previews - the viewer's link pane plays a video, shows an image, or
  reads the page in place
- [x] Edit/save notes to disk - **Edit** in the note header, Save (`Cmd/Ctrl+S`) or Cancel (`Esc`),
  with a failed save keeping the draft and showing the daemon's sentence (`src/components/NoteEditor.tsx`,
  `PUT /note`, `updateNote()`). Only the body is written: the frontmatter block survives character
  for character, the write goes through a temporary file and a rename, and the route shares every
  guard `GET /note` has (unknown folder, unsafe name, `404` rather than a create). After a save the
  listing, folder counts and graph are re-read, and a refresh that fails is said in the status bar
  instead of being reported as a failed save
- [x] Create a note from the desktop - **New** in the note list opens a composer in the list's own
  pane (`src/components/NoteComposer.tsx`, `POST /notes`). It uses the capture writer rather than a
  second one, so the first line is the title, `#hashtags` become tags and the filename is the usual
  `YYYY-MM-DD-slug.md`; the one difference is `source: desktop`, because the viewer shows that field
  and a note that claims the wrong origin is worse than one that says nothing. The folder starts
  where the list is looking, the composer keeps its draft through a failed create, and after the
  create the listing, folder counts and graph are re-read and the new note is opened
- [x] Rename, move or delete a note from the app - the **...** button in the note header opens
  `src/components/NoteActions.tsx` with three operations. Rename (`PATCH /note`, `renameNote()`) takes
  a title and renames both the file (keeping its date prefix) and the body's first heading, so the
  list, the viewer and the filename agree; move (`POST /note/move`, `moveNote()`) keeps the filename
  and only changes the folder; delete (`DELETE /note`, `deleteNote()`) asks first and moves the file
  into the vault's `.trash`. A target name another note holds is a `409` and nothing is replaced, a
  failure keeps the panel open with the daemon's sentence, and the listing, folder counts and graph
  are re-read afterwards
- [x] A rename carries the links that point at the note, instead of leaving every backlink pointing at
  a title that no longer exists. `linkResolver()` and `rewriteLinks()` in `@lumos/vault-utils/graph`
  ask the graph's own question ("what does this link point at?") and rewrite the target in place,
  keeping the link's shape - a title stays a title, a filename becomes the new filename, a heading, an
  alias and an embed marker survive - while a link that still resolves (a frontmatter alias) or sits
  inside code is left alone. `PATCH /note` answers the edited files as `updated`, and the desktop
  says how many followed
- [x] Undo a delete, and the trash behind it - `deleteNote()` moves the note to
  `.trash/<id>/<folder>/<name>` instead of removing it, `restoreNote()` and `POST /note/restore` put
  it back under its old name, and the status bar offers **Undo** until the notice is dismissed. The
  trash is a dot-folder, so the listings, the folder counts and the graph skip it without a rule of
  their own, and a restore refuses to replace a note that took the name again

- [x] Edit a note's tags and status from the app - the strip under the note header
  (`src/components/NoteMeta.tsx`) removes a tag, adds one and picks a status, through `PATCH /note/meta`
  and `updateNoteMeta()`. The daemon cleans a tag the way the graph reads it (no `#`, lower-case,
  de-duplicated), writes only the frontmatter block and leaves the body byte-identical, keeps a key
  another tool wrote, and refuses a block that does not parse instead of replacing it. The list,
  folder counts and graph are re-read after a change, because a tag is a chip and an edge
- [x] Preview the draft beside the editor - `src/components/Markdown.tsx` is now the one Markdown
  renderer, and `NoteEditor` draws the draft through it in a second pane that follows every
  keystroke. A **Hide preview** / **Preview** toggle (with `aria-pressed`) gives the textarea the
  whole width back, the two panes scroll on their own, an empty draft says "Nothing to preview yet.",
  and below the `md` breakpoint the panes stack. The saved note is read with that same component, so
  the preview cannot disagree with the reader

### Phase 8: Polish & Docs (P2)

- [x] `j`/`k` movement through the note list - stops at both ends rather than wrapping, counts as a
  pick (so it feeds the palette's recent notes), and stands down while a field has focus or the
  palette is open, so the letter is not stolen from a search box (`src/lib/list-nav.ts`, 8 unit
  tests)
- [x] Empty, loading and error states in every panel - the list says "Loading…" and then "No notes
  here yet.", the viewer says "Select a note to read it." and "This note is empty.", the palette
  has a loading line and names a failed body search, the link pane has a loading line, the daemon's
  own refusal and a **Retry**, and the graph pane falls back to the demo vault
- [x] Lazy loading of the graph renderer - 184 kB of canvas renderer loads with its own tab, so the
  notes path does not pay for it
- [x] A search index built once per vault load - `makeSearchIndex()` builds the fuse.js index when
  the vault arrives, not on every keystroke
- [x] The docs are complete and match the code - every document exists, is cross-linked, and was
  audited against the repository

### Phase 9: Agent access (P1)

- [x] An MCP server over the vault - `apps/mcp`, twelve tools over stdio (`list_folders`,
  `list_notes`, `search_notes`, `read_note`, `create_note`, `update_note`, `rename_note`, `move_note`,
  `delete_note`, `list_trash`, `restore_note`, `create_folder`). Notes are addressed by the key every
  tool answers (`Folder/name.md`), a refusal is a tool error carrying the vault's own sentence, and
  every operation goes through `@lumos/vault-utils`, so there is no second writer and a note an agent
  creates is stamped `source: mcp`
- [x] The vault is chosen by `LUMOS_VAULT` and defaults to this repository's - resolved from the
  source file rather than the client's working directory, because a client starts the process
  wherever it likes. The vault being served is printed on stderr: stdout belongs to the protocol, and
  that was measured (`pnpm --dir … start` writes its banner to stderr, so it is safe in front of
  stdout) rather than assumed
- [x] The containment check a read needs - `resolveNote()` splits a key, refuses anything that is not
  two segments or does not end in `.md`, and proves the resolved path is inside the vault root before
  a file is read, moved or removed. A folder a tool was given must already exist, so an agent cannot
  grow a top-level folder by filing into it
- [x] The connection guide - [mcp.md](mcp.md): running it, `claude mcp add` (with and without
  `LUMOS_VAULT`), the Claude Desktop JSON, the tool table, what the server refuses to do, and the
  trade-offs; linked from the root README, USAGE, ARCHITECTURE, AGENTS and CLAUDE.md
- [x] The MCP suite - 48 tests: the twelve operations against a temporary vault, the vault root and
  the key format, the real server over the real protocol through the SDK's in-memory transport, and
  the entry point spawned over a real stdio pipe with stdout asserted to be protocol-only (a stray
  `console.log` was injected to prove that assertion fails, then reverted)
