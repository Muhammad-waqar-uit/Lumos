# Lumos - Progress Log

Chronological record of what has been built. Newest entries first within each date.

## 2026-10-21

### Done — a scraped page is read once per session
- [x] Phase 5's session cache: `src/lib/link-cache.ts` keeps a `LinkCard` by URL at module scope, so a
  note switch, a tab switch and StrictMode's double mount cost one fetch and one scrape
- [x] A caller that arrives while the first request is still in flight joins that promise instead of
  starting a second request, which is the same rule covering the dev double mount
- [x] A refusal or a network failure is deleted from the cache, so **Retry** makes a real request
  rather than replaying the same error; `peekLink()` reads without fetching, so the pane can show a
  held card at render and never flash "Reading the page…" on the way back
- [x] 7 unit tests against an injected fetcher, so the suite stays offline; desktop suite 57, total 256
- [x] Verified in the browser against the temporary vault: opening a note whose link is
  `https://example.com/` made exactly one `GET /link` request; switching to another note and back
  made zero, and the reader card (title *Example Domain*, 156 characters of text) was present with
  no "Reading the page" line and no console errors

### Done — the empty palette offers what you just read
- [x] Phase 6's last item: with nothing typed, `Cmd/Ctrl+K` lists the five notes opened this session,
  newest first, instead of a hint line
- [x] `src/lib/recent.ts`: `rememberRecent()` (newest first, de-duplicated, capped, does not mutate its
  input) and `recentEntries()` (resolves keys against the loaded listing, so a note that left the
  vault is skipped), with 10 unit tests; desktop suite 50, total 249
- [x] Every route into a note goes through one `chooseNote()` in `App`, so the list, a graph node, a
  backlink and the palette all record the same way; the note the app auto-selects is deliberately not
  recorded, and the notes that become active because a filter narrowed the list are not either
- [x] The palette reuses the search result shape for the history rows, so the existing arrow keys and
  `Enter` needed no second code path
- [x] Verified in the browser against the temporary vault: opening *Plain note* and then *Code
  samples* put Code samples first in the Recent list and Plain note second; `↓` + `Enter` opened the
  second row, closed the palette and left focus on a button; after a reload the palette showed the
  hint line again, which is the real empty state

### Done — code in a note is highlighted
- [x] Phase 5's last rendering gap: fenced code is highlighted by `rehype-highlight` (highlight.js
  through lowlight), added to the markdown pipeline in `NoteViewer`
- [x] Only a fence that names a language is highlighted — `detect` is off, so an untagged block is not
  guessed at; a fence in an unregistered language is left as text and reported on the file rather than
  throwing, which is what lowlight does with an unknown grammar
- [x] The colours are `--color-code-*` tokens in `src/index.css`, beside the graph hues, with
  desaturated values chosen for the near-black background: no highlight.js theme stylesheet is
  imported and no colour sits in a component
- [x] 3 render tests in `src/components/NoteViewer.test.tsx`, using `renderToStaticMarkup` so the
  pipeline is asserted without a jsdom setup: a `js` fence yields `hljs-keyword`/`hljs-number` spans, a
  `zig` fence stays plain text, an untagged fence gains no `hljs` class at all. Desktop suite 40, total
  239
- [x] Verified in the browser against a temporary vault on its own daemon port (3101) and vite port
  (1422), so the real vault was never read: the JS, TS and Python blocks rendered coloured tokens
  (computed styles: keyword rgb(205,160,227), string rgb(141,206,163), comment rgb(115,115,115),
  number rgb(236,179,121), on a rgb(14,14,14) block), while the `zig` block and the untagged block
  rendered as single uncoloured text nodes; no console errors
- [x] The cost was measured rather than assumed: `vite build` on both sides of the change puts the
  main desktop chunk at 434.78 kB → 602.37 kB (135.34 kB → 188.54 kB gzipped). Recorded in
  `docs/LIMITATIONS.md` together with what is not there: no line numbers, no copy button, no theme

## 2026-10-20

### Done — the graph stops reshuffling when you leave the tab
- [x] Node coordinates and a camera the user placed are kept in `src/lib/graph-layout.ts`, at module
  scope, because a tab switch unmounts the canvas and force-graph lays a fresh graph out on
  construction; the next mount seeds each node with the place it had, so the layout resumes
- [x] A view the user panned or zoomed is restored exactly (zoom plus the graph-space centre); a view
  the app fitted itself is fitted again, since the pane may be a different size by then
- [x] Coordinates for notes that left the vault are pruned, so a deleted note cannot hand a stale
  place to a note that arrives later with the same id
- [x] The first fit waits for the engine to stop instead of a 250 ms timer, so the graph is framed
  after it has settled rather than where its nodes were heading
- [x] A resized pane refits when the view was the app's own, which fixes the graph sitting off-centre
  until *Fit*; a manual view is left alone, and `Fit` takes it back on request
- [x] 12 unit tests over the pure parts; the tab switch itself is still a manual check, since there is
  no jsdom setup to mount the canvas in

### Done — every note shows what points at it
- [x] Phase 5's backlinks panel: the note viewer lists the notes that link to the open one, and each
  row is a button that opens that note
- [x] `backlinks()` lives in `@lumos/vault-utils/graph` beside `neighborhood()`, so the rule for what
  counts is one implementation: only `link` edges pointing at the note, in the graph's own node order
- [x] A shared tag is deliberately not a backlink. The graph draws tag edges, so returning them here
  would have listed every note carrying `#rust` as "linked from", which is not what the word means
- [x] The viewer reads the graph the app already loaded (the demo graph offline), so the panel costs
  no request and works with the daemon stopped
- [x] 5 unit tests for the new function: the source list, a note nobody points at, the tag case, the
  tag node itself, de-duplication of a note that links twice, and an unknown id- [x] Verified in the browser against a temporary vault: three notes, two linking to the third, the
  panel showing "Linked from 2", and clicking a row opening that note in the Notes view. With the
  daemon stopped, the demo vault's **Learn Rust** listed its two sources, so the panel is not another
  feature that dies offline

### Done — the vault answers Cmd/Ctrl+K
- [x] Phase 6's search modal, built on `fuse.js`, the dependency the decisions log had already chosen
- [x] Title, tag and preview matches are ranked locally, so the palette works with the daemon stopped;
  the same query also goes to `GET /notes/search`, so a word that only appears deep in a body finds
  the note, and those rows are marked "in the body"
- [x] Keyboard: `Cmd/Ctrl+K` from anywhere, arrows to move, `Enter` to open the note in the Notes view,
  `Esc` to close with focus handed back; a status-bar button carries the shortcut so it is findable
- [x] The body search is debounced and stamped with the query it answered, so a slow reply cannot
  appear under newer text; a failed body search says so in the footer instead of silently falling
  back to local matches only
- [x] Verified in the browser against a temporary vault: `kubernetes` (only in a body) found the note
  with the marker, `kyoto` + Enter opened that note, `ArrowDown` + `Enter` opened the second result,
  and with the daemon stopped the same palette searched the five demo notes and said body search needs
  the daemon

## 2026-10-19

### Done — a docs sweep, so nothing still calls tag filtering unbuilt
- [x] The feature had landed while four documents still described it as future work: the M5 roadmap
  line, both READMEs, and `desktop.md`'s "still to come" list. A reader following them would have
  concluded the chips did not exist
- [x] Fixed those, and the stale test counts they sat next to (`README.md` said 82 daemon tests with
  the desktop untested; it is 83 and 15). Two tracking files needed it: the desktop-component row is
  now listed once, not twice
- [x] Historical `PROGRESS.md` checklists are left as written - the entries above supersede them

### Done — the demo vault shows its tags
- [x] Testing the tag filter offline found the demo vault half-built: its note bodies carried `#tags`
  (the graph drew tag nodes for them) while the listing entries had `tags: []`, so the chip row was
  empty with the daemon stopped - the one path a first-run user sees could not show the feature
- [x] Each demo note now lists the tags its body declares, with `#rust` on two of them so the counts
  have something to show, and one note deliberately untagged
- [x] A test compares every demo note's listing tags with `extractTags()` of its body, so the two
  cannot drift again; it was shown to fail by removing one tag, then restored
- [x] Verified offline in the browser with only Vite running: chips `#rust 2, #goal 1, #ideas 1,
  #interview 1, #reading 1`, and clicking `#rust` narrowed five demo notes to two

### Done — tags are a filter, not just text
- [x] The note list offers the tags in the current folder and query as chips with counts, most used
  first; clicking one narrows the list and clicking it again clears it. A note's own tag is the same
  control, so a tag filters wherever it appears
- [x] Folder and query decide which tags are offered, then the tag narrows that same set - so a count
  is always a count of what is listed, and an active tag stays in the row even when nothing matches,
  so it can be switched off instead of trapping the view
- [x] A selected tag survives a folder change and the empty state names it (`No notes tagged
  #travel.`) instead of looking like an empty vault
- [x] Selecting a tag node in the graph offers **Show notes**, which returns to the notes view with
  that tag filtered - the same handler the chips use, so the two cannot disagree
- [x] The logic moved out of the component into `src/lib/filter.ts` (`filterEntries`, `countTags`,
  `nodeTag`) so it could be tested without a DOM. The desktop workspace gained a `test` script and
  vitest, which is the first automated coverage of desktop code: 12 tests
- [x] Verified in the running app against a throwaway vault seeded over `POST /message`: seven chips
  with counts, `#rust` narrowed 5 notes to 2, `#travel` to 1, the `#japan` chip on a card filtered,
  and Reading with `#travel` active showed `No notes tagged #travel.`
- [!] Not exercised by hand: the graph's **Show notes** button. Selecting a node on the canvas needs a
  real pointer hit and the automation could not place one; the wiring is typechecked and shares the
  list's handler
- [x] One duplicate TODO row dropped rather than left open twice: tag filtering was listed in both
  Phase 5 and Phase 6

### Done — both features landed, and the gate is enforced now
- [x] `feat/social-embeds` merged as `24495f4` (PR #15). The `pnpm validate` check ran on the pull
  request and finished green before the merge — the first time CI had seen this code, since the
  workflow only triggers on PRs into `main` and pushes to `main`
- [x] `feat/hashtag-tags` was rebased onto the squash with `git rebase --onto origin/main 9cdb84c`,
  which produced no conflicts for a structural reason worth keeping: the squash tree was identical to
  the tree the branch already sat on, so the replay had the same base. Its diff was the 13 tag files,
  not the 16 embed files — the stacked order the branches were split in did what it was meant to
- [x] Merged as `53aab37` (PR #16). `main` carries both features; both branches deleted locally and on
  the remote
- [x] Branch protection turned on for `main`: `pnpm validate` is required, `strict` is on so a stale
  branch cannot merge, force pushes and deletions are blocked. Administrators are deliberately not
  enforced — one developer cannot approve their own review, and a break-glass push should stay
  possible on a personal repository. The cost is that it is a guardrail, not a lock, which is now
  written down in `docs/LIMITATIONS.md`
- [x] Every doc that still said the check was "reported, not required" was corrected in the same
  commit: `TODO.md`, `FEATURES.md`, `LIMITATIONS.md`, `ARCHITECTURE.md`, `roadmap.md` and the
  CHANGELOG, so the repository does not record a state it has left
- [x] `/help` lists itself now. The list had been one line short of the commands the parser accepts
  since it was written, and nothing compared the two — so the new test asserts the whole reply line by
  line, which makes a command that is added or renamed impossible to leave out of it silently

## 2026-10-17

### Done — a captured message tags itself
- [x] `saveNote()` now takes the `#hashtags` out of the message and writes them as the note's
  frontmatter tags. Every note used to be written with `tags: []` and nothing read the hashtags a
  message already carried - which was most obvious on an Instagram caption, where the platform hands
  back thirteen of them
- [x] The rules were **reused, not re-invented**: `extractTags()` from `@lumos/vault-utils/graph`,
  which the link graph already reads tags with. A second implementation would have let a frontmatter
  tag and a graph tag node drift apart, which is precisely the bug this feature would otherwise create
- [x] So the existing tested behaviour comes with it: a markdown heading is not a tag, a `#hash` inside
  a code span or fenced block is not a tag, `#Rust` and `#rust` are one tag, and the frontmatter wins
  the ordering
- [x] Verified through the real interface, not just the units: `POST /message` with `/idea plan the
  Kyoto trip #travel #Japan #travel` wrote `tags: [travel, japan]` on disk, `/notes/search?q=japan`
  returned the note by its tag, and the desktop's note list showed `#travel #japan` beside it
- [x] The first attempt failed for an instructive reason: the check came back `tags: []` because the
  daemon under test had been started *before* the change and `tsx src/server.ts` loads its imports
  once. Restarting it produced the tags - the code was right and the process was stale
- [x] One wrong expectation in a new test, caught by the test itself: the note's *title* keeps the
  hashtag, because a title is the message's first line verbatim, so the tag is what makes a note
  findable rather than something already visible in its name
- [x] 5 new tests (111 in `@lumos/vault-utils`, 82 in the daemon, 193 overall)
- [x] One narrow edge found by hand and written down rather than hidden: a body starting with `# `
  loses its tags, because the parser collapses a message to one line and the tag reader skips a line
  that looks like a heading. `docs/LIMITATIONS.md` now says so, with what would fix it

### Done — Instagram and Facebook links play in the app
- [x] A public reel and a public Facebook video were each embedded in a browser logged out and played:
  a real `<video>` element, unpaused, `readyState 4`, served from the platforms' own CDNs. A Facebook
  `plugins/post.php` embed rendered the video *plus* the caption and reaction counts, which is what
  made it the better choice for a post URL than the bare player
- [x] `parseLinkMedia()` gained `instagram` and `facebook`: Instagram `/p/`, `/reel/`, `/reels/`, `/tv/`,
  including a permalink written under the account name, normalised to `/p/<code>/embed/captioned/`;
  Facebook `/watch`, `/video.php`, `/reel`, `/<page>/videos/<id>`, `/<page>/videos/<slug>/<id>`,
  `/posts`, `/photos` and `/photo.php`, mapping to the plugin video player or the post card
- [x] `LinkMedia.frame` (`landscape`, `portrait`, `tall`) was added rather than two more kinds, so the
  pane sizes a frame from data instead of guessing from a URL
- [x] Deliberately left to the reader: `/share/...`, `/share/r/...` and `fb.watch/...`, whose real
  target is only known after a redirect, and any path that only looks like a video (`/videos/` with no
  id, `?v=not-a-number`, `/reel/short`)
- [x] The daemon now fetches Instagram and Facebook links for metadata as well. Measured first: a
  public reel answers `200` with its whole caption in `og:title` and its thumbnail in `og:image`, but
  `text` comes back 0 characters long - the body is a JavaScript shell - so those hosts show a caption
  card above the embed instead of an empty reader
- [x] `LinkPane` renders the frame from `LinkMedia.frame`, shows the metadata card under it, and says
  what the daemon is needed for: the page text for a page, the caption and thumbnail for an embed. A
  page that will not fetch and an embed without its card are now different, true statements
- [x] Verified in the running app with a temporary vault (never `vault/`): the Instagram note renders a
  portrait reel with the caption card, the Facebook note a 16:9 player with its card, and an article
  note still renders the reader - so the existing path did not regress
- [x] Verified with the daemon killed as well, by pointing a demo note at the reel: the frame still
  plays, the card is gone, and the pane explains why. The temporary demo edit was reverted and the
  file is byte-identical to `main`
- [x] 8 new tests; the suite is 188 (107 in `@lumos/vault-utils`, 81 in the daemon)
- [x] `docs/LIMITATIONS.md` gained the honest half: only public content, dead permalinks that still
  answer `200`, a mixed-locale Facebook title, nothing downloaded, and no way for a test to warn you
  when a platform changes its plugin
- [x] Not verified: the same embeds inside the packaged Tauri window. They were checked in Chromium,
  which is the engine's family but not the engine; the manual check is recorded in `LIMITATIONS.md`

## 2026-10-16

### Done — every doc audited against the code
- [x] All 18 Markdown files were read against the repository rather than trusted: 89 internal file
  links all resolve, every referenced path exists, and all eight HTTP routes appear in each doc that
  claims to document them
- [x] `docs/LIMITATIONS.md` needed no change - every entry was re-checked against the code and still
  holds (no component tests, the Tauri shell untested, the graph rough edges, frontmatter not
  validated, branch protection off, CI Linux-only)
- [x] `vault/` was confirmed still git-ignored and untracked (0 files tracked, 0 visible), and was
  not read, written or logged
- [x] The largest drift was `docs/design.md`: it documented shadcn-style tokens (`--background: 0 0%
  3.9%`, `--card` at 3.9%, `--radius`, a `--destructive` pair) while the stylesheet actually declares
  Tailwind v4 `@theme` entries named `--color-*` holding complete `hsl()` values, with `--card` and
  `--popover` at 5.5%, `--radius-lg`, and no destructive token at all. The graph tokens - the part
  with a real reason for existing - were missing entirely, as was the reason they sit outside `@theme`
- [x] `docs/desktop.md` presented `Cmd/Ctrl+K`, arrow/`j`/`k` and `Esc` as working shortcuts; there is
  no key handler anywhere in `src/`. Now marked specified-but-not-wired, alongside the two already
  built features that were listed under "Planned capabilities" and a `graph-palette.ts` description
  that claimed helpers for radii the module never computes
- [x] `docs/PLAN.md` listed TanStack Router, zustand, fuse.js and lucide-react as the desktop stack;
  none is installed. Split into "in use today" and "chosen, not installed", and the search-scope
  open question is now marked resolved by `searchNotes`
- [x] `README.md` still sold `/find` as "coming soon" after it shipped, dated a note `2025-10-13`, and
  documented two of the eight endpoints; the read API is now named there, and `PORT` and
  `LUMOS_DISABLE_WHATSAPP` are documented in both the README and `docs/daemon.md` (they were in
  neither)
- [x] `docs/FEATURES.md` described the HTTP API as `POST /message` and `GET /health` only
- [x] No file links were broken by the corrections, and the fix commits carry the doc changes with
  them, as the repository requires

### Done — the daemon's routes are tested
- [x] The Fastify app moved out of the entry point: `createApp()` in `apps/daemon/src/app.ts` builds it
  (CORS + every route) over a vault directory, and `server.ts` is now only the bootstrap that listens and
  starts WhatsApp
- [x] `handleMessage()` takes the vault as an argument instead of reading `VAULT` from module state, so a
  caller decides where a note lands; `vault.ts` is left as the one place the path is resolved
- [x] The handler test no longer has to set `VAULT_PATH` and re-import the module before it can run
- [x] 22 route tests in `app.test.ts`, driven through `app.inject()` so no port is bound and no network
  request is made: `/health`, `/message` (missing text, a malformed message, and a filing that is checked
  on disk), `/notes` and its empty case, `/notes/search` (match, blank query, no match), `/folders`,
  `/note` (missing parameter, unknown folder, each traversal shape, a real note, a 404), `/graph` (nodes,
  edges, unresolved links, empty vault), `/link` (refusals and the 200/400/502 mapping with the fetcher
  injected, plus a generic message that carries no stack trace), and the CORS allow-list
- [x] The traversal test leaves a decoy note outside the folders and asserts a 400 with no leak; removing
  the guard makes it fail, so the test can fail for the right reason
- [x] The daemon suite is 81 tests and the whole suite is 180
- [x] Two documented gaps closed: `docs/TODO.md` Phase 0.1 route tests, and the `docs/LIMITATIONS.md`
  entry saying the HTTP routes had no tests because the app was built inline

### Done — links play and read in the app
- [x] A link in a note is no longer just something to click away from: the note viewer shows it in place
- [x] `@lumos/vault-utils` gained a browser-safe link module (its own `./link` subpath): `parseLinkMedia()` (YouTube across `watch`/`youtu.be`/`shorts`/`embed`/`live`/music, Vimeo in both shapes, an image by extension, else a page), `extractPreview()` (og/twitter/title metadata plus readable text, tags stripped, entities decoded, 6,000-character cap) and `firstExternalLink()` (the first link in a note body, code fences ignored like the graph does)
- [x] 24 tests for the link module: every URL shape including the lookalike `youtube.com.evil.example`, non-http schemes, channel pages, article-vs-body extraction, entity forms, truncation, and `firstExternalLink` skipping code
- [x] Daemon: `GET /link` fetches one URL through `fetch-link.ts` and returns a `LinkCard`; a video or an image is answered from the URL alone, so playback needs no daemon at all
- [x] The URL is treated as untrusted: only `http(s)`, no credentials in the URL, and a refusal for `localhost`, `*.local`/`*.internal`, loopback, private, link-local, CGNAT and reserved addresses — for the URL written *and* for every redirect hop, since a public link can redirect into the local network
- [x] Bounded on purpose: 8 s timeout, 3 redirects, 1 MiB body, HTML/XHTML/text content types only. A refusal is a 400, an unreachable page a 502, and the URL is never logged
- [x] 22 tests for the fetcher, with `fetch` and DNS injected so the suite stays offline: the address table, hostnames, a redirect into a private host, the redirect limit, the byte cap, the content type, and that a socket error's detail never reaches the message
- [x] Desktop: `LinkPane` in the viewer — a 16:9 no-cookie embed for a video (with an “Open on …” fallback), the image itself for an image, and for a page a card with title/site/description/lead image plus the readable text, with loading, error-and-retry, and daemon-down states
- [x] Verified in the browser against the running daemon and a throwaway vault: the YouTube note rendered the embed and, once clicked, the poster was replaced by a playing frame (the embed document loaded 200; no `/link` request was made for it); the MDN note rendered title, site, description and 6,000 characters of text with the cut notice; the `http://localhost:3210/notes` note rendered “That link points at this machine or the local network.” with its Retry button
- [x] The pane renders the scraped text as text, never as HTML, so a page cannot inject markup into the app
- [x] No new dependency: the extraction is a few pure functions in the existing package, recorded as a decision in `PLAN.md`
- [x] `docs/LIMITATIONS.md` added, and the docs that enumerate the doc set (README, PLAN, ARCHITECTURE, CONTRIBUTING, RULES, CLAUDE, AGENTS, both app READMEs) point at it: the known limits in one place, with what each gives up — the reader's JavaScript blind spot and refused local addresses, the cache-less refetch, the untested WhatsApp session and Tauri shell, branch protection still off, and the HTTP routes having no tests

### Next up
- [ ] Turn on branch protection on `main` so the green `pnpm validate` check is required to merge
- [ ] Link pane: keep a scraped page for the session (it refetches when the note is reopened, and twice in dev under StrictMode)
- [ ] Link pane: strip site chrome harder — the reader still carries code samples and repeated navigation text from some pages
- [ ] Frontmatter schema validation, and reporting a malformed note instead of skipping it silently
- [ ] `/help` does not list itself in the command list it prints

## 2026-10-15

### Done — vault graph view
- [x] `@lumos/vault-utils` gained a browser-safe graph module (its own `./graph` subpath): `extractLinks`/`extractTags` over note bodies, `buildGraphFromNotes` (notes + tags as nodes, links and tag references as edges, `inDegree`, `orphan`, unresolved targets reported rather than invented) and `neighborhood()` for hop-limited subgraphs
- [x] The module reads no filesystem, so the same code runs in the daemon and in the desktop bundle
- [x] Daemon: `GET /graph` returns the vault's graph; CORS and the vault-root guards stay in place
- [x] 41 new tests against a temporary vault (link forms, tag extraction, backlinks, orphans, unresolved links, neighbourhood depth); `@lumos/vault-utils` is now 75 tests and the suite is 107
- [x] Desktop: a Graph tab beside Notes — canvas force layout, glow nodes sized by backlink count, curved synapse edges, one hue per folder from the theme tokens, controls for tags, unlinked notes and depth
- [x] Clicking a node selects it (panel shows in/out degree, with a button that opens the note in the Notes view); hovering pulls its links forward and draws the label
- [x] Offline path exercised with the daemon stopped: the pane renders "Offline — demo vault" and the demo graph instead of a blank screen (4,064 painted pixels, 5 notes, 9 links)
- [x] Verified in the browser at pixel level: node cores in the intended per-folder hues, edge-coloured and tag-coloured line pixels present, painters running (~570 curves/second); the depth-1 result (4 notes, 7 links, 1 unresolved) matched an independent recomputation of `neighborhood()` against the daemon's own data — no console errors
- [x] Two real defects found and fixed on the way: the React wrapper for the graph renderer silently drops its canvas-object props, so the pane now drives the library's vanilla instance API; and Tailwind pruned the palette-step tokens that only TypeScript referenced, so the `--color-graph-*` values are plain `:root` custom properties. A failed lazy chunk used to leave a blank app — it now renders an error with a retry

### Done — test gate (vitest)
- [x] Both open PRs merged into `main` (`#1` tooling and rules, `#2` markdown viewer); `main` is now `df44395`
- [x] vitest 5 added at the root, to `@lumos/vault-utils` and to the daemon; `pnpm test` runs every workspace that has a suite
- [x] 34 tests for `@lumos/vault-utils`: slugify, title choice, frontmatter parse/serialize (BOM, CRLF, unterminated block, string tag), save/read/list and search against a temp vault
- [x] 32 tests for the daemon: `parseMessage` for every command and for malformed input, plus `handleMessage` filing real notes into a temp vault
- [x] `pnpm validate` now runs the tests between typecheck and build, so the pre-push hook cannot let a red suite through
- [x] The gate was shown to fail, not just pass: mutating `slugify`'s trailing-dash trim turned the suite red (exit 1); the file was restored and the diff checked clean
- [x] Two findings from writing the tests, recorded in `TODO.md`: `/help` does not list itself, and the filing reply echoes the title exactly as typed

### Done — CI gate (`.github/workflows/validate.yml`)
- [x] The gate the local hooks run now also runs on the repository: every PR into `main` and every push to `main`
- [x] pnpm's version comes from the `packageManager` field in `package.json` (nothing to keep in sync by hand); Node 24, with pnpm's store cached off `pnpm-lock.yaml`
- [x] The validate step calls `pnpm run validate`, so the workflow never restates the gate — the suites that landed with `test/vitest-gate` (PR #3) ride inside it
- [x] Pinned `actions/checkout@v7`, `actions/setup-node@v7` and `pnpm/action-setup@v6`: the v4-era actions run on a Node 20 runtime that GitHub removed in September 2026
- [x] Verified locally: the YAML parses to the intended shape (triggers, five steps, concurrency group), prettier accepts it, and `pnpm install --frozen-lockfile` then `pnpm run validate` both exit 0
- [x] Exercised on the pull request itself, not just described: the `pnpm validate` check ran on PR #4 and finished green (run `38783175553`), so the gate works before it exists on `main`
- [x] Landed on `main` (PR #4, `aaa7571`) and the first run on `main` is green: run `38790615355`, push event, every step passed
- [!] Branch protection is repository-side and still off: the check is not yet required to merge

### Done (continued) — `/find`
- [x] `/find <query>` answers with real results instead of "Search isn't built yet.", reusing `searchNotes` from `@lumos/vault-utils` so the command and `GET /notes/search` share one definition
- [x] Replies are capped at five matches with "and N more.", and an empty query asks for one instead of searching for nothing
- [x] Written test-first: five tests added to `src/handler.test.ts` failed against the stub, then passed once it was implemented (37 daemon tests now)
- [x] Exercised over real HTTP against a temporary vault on a spare port — `/find zeta` returned both matching notes across Ideas and Goals, `/find ZETA` matched case-insensitively, no-match and empty-query replies were correct, then the daemon was stopped and the temp vault deleted

### Next up
- [ ] Turn on branch protection on `main` so the green `pnpm validate` check is required to merge (the workflow itself runs on every PR and every push)
- [ ] Route tests for the read API (needs a Fastify factory extracted from `server.ts`)
- [ ] Tag filtering + syntax highlighting for fenced code
- [ ] Graph follow-ups: a backlinks panel in the note viewer, tag nodes styled and clickable apart from notes
- [ ] Resizable panes, TanStack Router, zustand
- [ ] Phase 3: link expansion, `/plan` with Ollama, tagging

## 2026-10-13

### Done
- [x] Monorepo scaffold with pnpm workspaces (`apps/daemon`, `apps/desktop`, `packages`)
- [x] Daemon core: command parser, vault writer, handler, Fastify server
- [x] WhatsApp bridge via Baileys (QR auth, allowlist, auto-reconnect)
- [x] HTTP API: `POST /message`, `GET /health`
- [x] `.gitignore`, `LICENSE` (MIT), README
- [x] Desktop app scaffolded (Tauri + React + TypeScript)
- [x] Repository pushed to GitHub (`Muhammad-waqar-uit/Lumos`)

### Done (continued)
- [x] Phase 1: tracking + reference docs (`PLAN.md`, `TODO.md`, `PROGRESS.md`, `FEATURES.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/*`)
- [x] Phase 2: `@lumos/shared` (types) and `@lumos/vault-utils` (slugify, parse/serialize, read/list/search/write)
- [x] Refactored the daemon onto the shared packages; `handleMessage` + vault round-trip verified with `tsx`
- [x] `tsc --noEmit` passes for daemon, shared, and vault-utils

### Done (continued 2)
- [x] Daemon read API: `GET /notes`, `/notes/search`, `/folders`, `/note` (+ CORS for local origins, path-traversal and folder guards)
- [x] Desktop dark UI: Tailwind v4 tokens, three-pane shell (Sidebar, NoteList, NoteViewer, StatusBar)
- [x] Desktop loads the vault from the daemon with a demo fallback when it is offline
- [x] Verified live in the browser: real notes listed, opened, and searched; no console errors
- [x] `tsc --noEmit` passes for daemon + desktop; `vite build` succeeds; `/note` traversal returns 400

### Done (continued 3) — tooling, enforcement and workflow
- [x] oxlint replaces the ad-hoc check (TS-version compatible) and prettier owns formatting
- [x] Husky + lint-staged + commitlint installed; hooks cannot be bypassed
- [x] Root scripts added: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `build`, `validate`
- [x] `pre-commit` now also refuses to commit on `main`, so the branch workflow is enforced by the tooling
- [x] Unified TypeScript `~6.0.3` across all four workspaces; `typecheck` script in every workspace
- [x] `RULES.md`, `AGENTS.md` and `CLAUDE.md` written; `CONTRIBUTING.md` and `README.md` point at them
- [x] Branching model adopted: short-lived `<type>/<description>` branches, PR into `main`, squash-merge, no direct commits
- [x] Generated Tauri schemas excluded from formatting; `pnpm validate` verified green end to end
- [x] Fixed two real lint findings in the desktop app by deriving state at render instead of repairing it in effects

### Done (continued 4) — Markdown note rendering
- [x] Note bodies render as Markdown (`react-markdown` + `remark-gfm`) instead of preformatted text
- [x] GFM coverage: headings, nested lists, ordered lists, tables, task lists, blockquotes, fenced code
- [x] Note links open externally (`target="_blank"`, `rel="noreferrer"`) so the window never navigates away
- [x] `.markdown` styles in `index.css` use the existing dark tokens — no hex values in a component
- [x] Verified against the running daemon: an 11-block note renders with the expected DOM elements and computed styles, all requests 200, no console errors

## Template for new entries

```
## YYYY-MM-DD
### Done
- [x] ...
### In progress
- [~] ...
### Blocked
- [!] ... (reason)
```
