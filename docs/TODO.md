# Lumos - Master TODO

The checklist, ordered by where each item actually stands: the checks only a person can make, then
what is planned, then what is in flight, then what is done. The phase a piece of work belongs to
stays on the item, so the phases in [`PLAN.md`](PLAN.md) still map onto it.

**Legend:** `[!]` needs a manual check by a person · `[ ]` todo · `[~]` in progress · `[x]` done ·
Priority: P0 critical, P1 high, P2 medium, P3 low

## Needs your testing

Four checks that no unit test can close: each needs a device, a real window or a pointer. They are
first because they are the shortest path to knowing the app works end to end, and because nothing
else on this page can close them.

- [!] **The Tauri shell** (P1) - `pnpm --filter desktop tauri dev`: the window opens, the vault
  loads, the daemon URL is right, and the packaged bundle runs. The Rust side, the window
  configuration and the bundle have never been exercised.
- [!] **A live WhatsApp session** (P1) - pair a device with the QR code and send a real message, so
  the capture path is checked against the platform rather than against a parser and a stub.
- [!] **The social embeds inside the packaged window** (P2) - a reel, a video and a post were
  verified in Chromium, which is the engine's family but not the engine.
- [!] **The graph's "Show notes" button** (P2) - selecting a tag node on the canvas needs a real
  pointer hit, so the wiring is typechecked but has never been pressed.

## Plan

### Phase 0.1 - Enforcement (P1) - open items

- [ ] Desktop component tests (jsdom + Testing Library) for the sidebar, the list, the search
  palette and the link pane, plus an E2E smoke test. The viewer is already asserted by SSR renders
  (`src/components/NoteViewer.test.tsx`), and the daemon's unit and route tests are done.

### Phase 3 - Daemon enhancements (P1) - open items

- [ ] `/plan today|tomorrow` with Ollama integration
- [ ] Config file support (dotenv / JSON)

### Phase 4 - Desktop UI foundation (P0) - open items

- [ ] TanStack Router setup
- [ ] zustand state management (currently plain React state)

### Phase 5 - Vault browser (P0) - open items

- [ ] Link pane: strip site chrome harder - the reader still includes code samples and repeated
  navigation text from some pages
- [ ] Link pane: read a PDF or a plain HTML file the same way (today a non-HTML content type is
  refused with its type named)

### Phase 7 - Editing & enrichment (P2) - open items

- [ ] Markdown editor with preview
- [ ] Edit/save notes to disk
- [ ] Bulk operations (move, tag, archive)

### Phase 8 - Polish & docs (P2) - open items

- [ ] Subtle transitions - panes and panels change without a fade; only hover colours transition
  today
- [ ] List virtualization, so a large vault does not put every row in the DOM at once
- [ ] A daemon-side search index, so a body match does not read whole files on every query
- [ ] Screenshots in the docs
- [ ] `USAGE.md` - a standalone guide; the README's usage section covers the commands today

## In progress

Nothing in flight. The next item to pick up is the first one under **Plan**.

## Done

### Phase 0: Enforcement & Workflow (P0)

- [x] oxlint as the linter (kept in step with the TypeScript version), prettier as the formatter
- [x] Husky hooks: `pre-commit` (lint-staged), `commit-msg` (commitlint), `pre-push` (`pnpm validate`)
- [x] Root scripts: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `build`, `validate`
- [x] `pre-commit` refuses to commit while on `main` - the branch workflow is enforced, not just
  documented
- [x] `pnpm validate` = lint + format:check + typecheck + test + build
- [x] One TypeScript version (`~6.0.3`) across every workspace, with a `typecheck` script in each
- [x] `RULES.md` (build / commit / branch standards), `AGENTS.md` (agent working agreement), `CLAUDE.md`
- [x] Branching model in writing: short-lived `<type>/<description>` branches, PR into `main`,
  squash-merge
- [x] Generated Tauri schemas excluded from formatting; prettier clean across the repo

### Phase 0.1: Enforcement (P1)

- [x] GitHub Actions workflow (`.github/workflows/validate.yml`) running `pnpm validate` on every PR
  into `main` and every push to `main`
- [x] Branch protection on `main`: requires a pull request and the `pnpm validate` check, with
  `strict` on so a stale branch cannot merge; force pushes and deletions blocked (on since
  2026-10-19; the workflow's first run on `main` was green in `38790615355`)
- [x] Test runner (vitest) wired up and added to the validation gate - 221 tests over
  `@lumos/vault-utils` and the daemon, plus 75 over the desktop (filtering, demo data, search
  ranking, recent notes, the link cache, list movement, pane widths, graph layout memory, and the
  viewer's code highlighting and frontmatter warning), so 296 in `pnpm validate`
- [x] Schema validation for note frontmatter - `validateFrontmatter()` in `@lumos/vault-utils`
  checks the fields the app relies on and the problems travel with the note (`Note.problems`,
  `VaultEntry.problems`) instead of the file being skipped. It runs when a note is read, and the
  rules are pinned by unit tests inside the gate; the vault itself is git-ignored, so CI can only
  validate fixtures, never a user's notes
- [x] Route tests for the read API - `createApp()` in `app.ts` builds the Fastify app over a vault
  directory, so `app.inject()` covers `/health`, `/message`, `/notes`, `/notes/search`, `/folders`,
  `/note` (every guard), `/graph`, `/link` and CORS without binding a port, and with the link
  fetcher injected so the suite stays offline

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

- [x] Full-text search with fuse.js - the palette ranks titles, tags and previews over the loaded
  vault, tolerant of typos, and works with the daemon stopped (`src/lib/search.ts`, 10 unit tests)
- [x] Cmd/Ctrl+K search modal - opens from anywhere, arrows move the selection, Enter opens the note
  in the Notes view, Esc closes and focus goes back; the status bar carries a Search button with the
  shortcut beside it, so the key is discoverable without knowing it
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
