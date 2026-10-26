# Lumos - Progress Log

Chronological record of what has been built. Newest entries first within each date.

## 2026-10-26

### Done - the WhatsApp link is in the app, and the palette can create
- [x] Capture was the one part of the product with no face: whether a phone was linked could only be
  learned from the terminal the daemon was started in, or by messaging it and waiting. The status
  bar now carries a chip with the link's own state and a panel behind it - the sentence, the pairing
  code, and one button. `GET /whatsapp` answers `{ enabled, state, since, error, qr }`;
  `POST /whatsapp/connect` and `POST /whatsapp/disconnect` drive it
- [x] **Two dots, two facts.** The footer's left-hand dot was already the daemon: can notes be read
  right now. A second green dot for WhatsApp would have said the two things were one, so the chip
  carries its own word (`WhatsApp linked`, `Pair WhatsApp`, `WhatsApp unlinked`) and only turns green
  while messages are actually being filed
- [x] **The state is a module, not a socket query.** `bridge.ts` holds off / starting / waiting /
  connected / disconnected / logged-out / error, and the moment each began. A code rotating every few
  seconds re-states `waiting`, and `since` deliberately does not move with it - "waiting since"
  should mean since pairing began, not since the last code. `whatsapp.ts` became
  `createWhatsAppBridge()`, which returns the controller the routes call and keeps a pause flag so a
  deliberate stop does not trip the auto-reconnect
- [x] **The code comes from the daemon, drawn.** No QR library entered the desktop: the route answers
  the same half-block text the pairing page draws, and the panel renders it in a dark `<pre>` whose
  line height is exactly two character widths. It is absent in every state but `waiting`, because a
  code that has expired is worse than none - it scans and does nothing
- [x] **Disconnect is not an unlink, and the panel says so.** The pairing lives in `auth_info` and on
  the phone; nothing in this process can take a device off an account a person holds. Disconnect
  stops the notes, Connect needs no code, and an unlink from the phone is noticed and reported as
  `logged-out`. That limit is written down in [LIMITATIONS.md](LIMITATIONS.md)
- [x] **The palette can now create.** `Cmd/Ctrl+K` offers **New note**, **New folder**, **Open the
  graph** and **Open the trash** under the recent notes - and first once the query matches a command,
  so `new folder` is reachable without leaving the field. Choosing New folder turns the field into a
  name field: `Enter` makes it and the list looks at it, `Esc` steps back out, and a refusal keeps the
  name typed with the daemon's sentence. The composer's open state moved from the list to the shell,
  because the palette opens it too
- [x] **"Linked" and "linked and working" are different answers.** A socket can be open all day
  with nothing sent to it, so the report grew `lastAt` - when a message was last answered - and the
  panel says `last message 14:31` beside the state. It is deliberately not part of the state
  machine: answering a message does not change whether the link is up, and a `since` that moved on
  every note would say nothing about the connection
- [x] Verified against a running daemon, not only the units: `GET /whatsapp` answered
  `{"enabled":false,"state":"off","since":null,"error":null,"qr":null}` on a daemon started with
  `LUMOS_DISABLE_WHATSAPP=1`, `POST /whatsapp/connect` answered `409` with the setting named, and
  `POST /whatsapp/disconnect` and `GET /qrcode` still answered `200`

## 2026-10-25

### Done — a folder can be renamed or removed
- [x] `renameFolder()` and `removeFolderNotes()` in `@lumos/vault-utils`. The rename is one
  directory rename: every note inside keeps its filename, its date and its bytes, and the links
  that *named the folder* (`Movies/…md`) are rewritten in the notes that carried them - a link by
  title or slug still resolves, because the resolver finds the note wherever it lives, so the
  author's wording is left alone. The remove moves the notes to Inbox (the folder is only a place
  to file things, so removing one never takes a note with it), then drops the empty directory; a
  folder still holding non-note files is kept and the reply says so, the same rule the trash
  follows. Every name is checked before anything moves, so a refusal changes nothing
- [x] `PATCH /folder` and `DELETE /folder` on the daemon, plus `/renamefolder Movies|Film` and
  `/delfolder Movies` (`/removefolder`) on WhatsApp. The separator is `|` because that is the one
  character a folder name can never carry, so the two halves cannot be read the wrong way. Inbox
  cannot be removed - there is nowhere to move its notes - and a folder that does not exist is a
  `404` in the daemon's own sentence
- [x] The sidebar's every folder row carries **Rename** and **Delete**: rename is an inline field
  that follows the row to its new name and count; delete asks first ("Remove Movies? The 12 notes
  inside move to Inbox."), and the Inbox becomes what the list is looking at afterwards. Both are
  offered only while the daemon answers - with the daemon down the app is showing demo data, and a
  write button over demo data would be a lie
- [x] Verified through the real interface, not only the units: `PATCH /folder` renamed a folder on
  a fixture vault and the notes landed in the new path with the links rewritten;
  `DELETE /folder` moved its notes to Inbox and the directory was gone. `pnpm validate` green -
  659 tests (vault-utils 248, daemon 206, desktop 205)

### Done — the Pair button goes somewhere
- [x] The status bar's QR button opened `http://127.0.0.1:3001/qrcode`, which did not exist: the
  daemon only ever printed the code in the terminal, so the button was a 404 and the docs described it
  as working. It is a page now (`GET /qrcode`): the code the socket is waiting for, drawn as
  half-block text in a `<pre>`, refreshing every ten seconds because the code rotates, `no-store` so a
  stale one is never served, and a plain sentence when there is nothing to pair
- [x] **The polarity is the part worth knowing.** `qrcode-terminal` has two modes: the plain one draws
  ANSI background colours, which a page cannot use (all spaces once escaped), and the small one draws
  the *light* modules as blocks. So the page is light-on-dark - rendered the other way round it would
  be an inverted code, which a phone may refuse. A test pins the block characters, the absence of
  escape codes and equal line widths; whether a camera reads it is under **Needs your testing**
- [x] The button itself was backwards: it appeared when the daemon was *not* reachable, which is
  exactly when the page cannot be served. It now shows while the daemon answers, and says **Pair**

### Done — folders you make, and a menu to find them by
- [x] `Folder` is no longer a union of five names. A folder is a directory, so the set is the
  vault's own: `listFolderNames()` reads it (seed folders first, then the rest alphabetically,
  dot-directories left out) and `createFolder()` makes one after the same name check the routes use.
  Every route that used to test `FOLDERS.includes(...)` now asks the vault, so a folder made a
  moment ago is accepted instead of refused as unknown
- [x] `/newfolder Movies` on WhatsApp, or **+ New folder** in the sidebar, which is `POST /folders`.
  The reply names the command the folder just earned (`Send /movies <text>`), because the point of
  making a folder is being able to file into it without guessing
- [x] `/movies` needed no entry anywhere: the command map is built from the folder list
  (`folderCommands()`), so any folder answers to its own name - `To Read` to `/to-read` - while the
  four documented shorthands (`/idea`, `/interview`, `/goal`, `/read`) still work. A folder's own
  name wins over a shorthand, because the folder is the thing the person made
- [x] A bare `/` answers with the menu. WhatsApp offers no slash-command autocomplete in a chat, so
  the list has to be one keystroke away instead of remembered; the menu is built from the folders on
  disk, which is why it lists a folder made a minute ago. That limit is written down in
  [LIMITATIONS.md](LIMITATIONS.md) rather than papered over
- [x] The desktop had five folder lists baked in - sidebar, composer, move menus, bulk move, graph
  legend - and all five read one list now. The graph gave every unknown folder the tag grey; it
  takes the colour list from the vault instead, so a folder made later has a hue of its own
- [x] Verified through the real interface, not only the units: `POST /message` with `/newfolder Movies`
  then `/movies https://example.com/trailer` wrote `Movies/…md` with `url:` in its frontmatter, and
  `GET /folders` answered `Movies` with a count. `pnpm validate` green - 592 tests (vault-utils 226,
  daemon 175, desktop 191)

### Done — three pictures of the app (screenshots, Phase 8)
- [x] `docs/images/` holds the notes view (folders, tag chips, the list, the open note with its tags,
  status and backlinks), the search palette with a row marked *in the body*, and the graph with its
  tag nodes and depth control. `README.md` takes the first as its hero and `USAGE.md` places each
  beside the section it explains.
- [x] **Taken with Playwright, not the browser panel.** The panel's own floating badge sat over the
  app's title in the first capture, and hiding it in the page did not remove it from the frame - the
  badge is drawn by the shell, not by the document. A throwaway Playwright script photographs only
  the page, waits for the list to fill rather than for the first paint (the first attempt caught an
  empty shell), and reports console errors, of which there were none.
- [x] **A throwaway vault, not the real one.** Eight notes over the five folders, with links, tags,
  a task list, a table and a code fence, so each panel has something to show; the first graph shot
  was a bare chain, so a few cross-links were added to the same notes and the shot retaken. Nothing
  from anyone's vault is in a published image.

### Done — the new mark, everywhere it is drawn
- [x] The artwork is replaced: a wand throwing a four-point spark, with three rays ending in nodes.
  Five places held the old ring-and-spokes lamp and all five now hold the new drawing - the sidebar
  component (inline, `currentColor`, so `--color-brand` still supplies the hue), the browser tab,
  the four `assets/` SVGs, and the Tauri icon set, which is generated rather than hand-exported:
  `pnpm --filter desktop tauri icon ../../assets/lumos-app-icon.svg` rebuilt the PNG, ICO and ICNS
  files from the one 512 tile. The mobile icon folders that command also writes were deleted - this
  is a desktop app.
- [x] **The light variant is a recolour, not a second drawing.** Same geometry, no tile, ink text,
  the amber darkened to `#C77F00` so it holds its edge on white, and the glow dropped with the
  ground it was lighting. Losing the glow is the one visible concession: a radial wash that reads as
  light on near-black reads as a smudge on white.
- [x] **The sidebar mark's viewBox is cropped** (`20 40 140 140`) - the art sits off-centre in the
  200-unit tile, which left the icon lopsided in a 24px slot. Checked by screenshotting the running
  app, not by reading the SVG.
- [x] The C2PA provenance block every delivered file carried is stripped, so the assets hold the
  drawing and nothing else. `docs/design.md` describes the new mark and why the tab and the window
  icons cannot drift apart.

### Done — a guide that stands on its own (USAGE.md, Phase 8)
- [x] `USAGE.md` at the root: what the daemon and the desktop each are and how to start them, the
  WhatsApp commands and what a message becomes (title, filename, tags, frontmatter), the vault's
  shape and one real note, and the desktop app end to end - finding a note, reading, writing, bulk
  actions, the graph, the panes, the keys.
- [x] It covers what the README only tours: the HTTP API with three runnable `curl`s, the settings
  file and every environment variable, and a troubleshooting table built from the sentences the
  app and the daemon actually print (`! frontmatter`, `409` on a taken name, `400 unknown folder`,
  the status bar's demo fallback, Ollama not answering).
- [x] Every claim was checked against the code rather than the other docs - which is how the Esc
  row lost "dismisses a notice": a notice is dismissed by clicking it, and Esc only closes the
  palette and cancels an edit.
- [x] README's Documentation list links it; `pnpm validate` green.

### Done — search stops reading the vault twice (daemon-side index, Phase 8)
- [x] **The change.** `createNoteSearch` (`packages/vault-utils`) keeps each note body it has read,
  lowercased once, beside the file's mtime and size. A body is re-read only when either figure
  moves, and the entry for a note that has left the vault - deleted, or moved under a new name -
  is dropped on the next query. `searchNotes` stays as the one-shot API WhatsApp's `/find` uses and
  is now a thin wrapper over a throwaway index, so the matching rule (title, excerpt, tags, body)
  exists in one place.
- [x] **What is deliberately not cached.** The listing still runs per query. A cache of the
  listing would make the app miss a note the phone wrote a second ago, and the gain would be the
  part that is cheap to redo; the 1.9 MB of Markdown was the part worth keeping.
- [x] **Tests, red first.** Six over the index: a body-only match, a title match answered as
  before, an empty query, one body read across three searches (an injected reader counts them),
  a re-read after the file changes, and an entry forgotten when the note is deleted. Two route
  tests hold the lifecycle the app actually has a risk of getting wrong: a note another process
  wrote after startup is found, and a note deleted after the index saw it stops matching.
- [x] **Measured, not assumed.** A throwaway 600-note vault (1.9 MB) against the real routes:
  `searchNotes` 446/370/345 ms, warm `createNoteSearch` 366/184/185 ms - the cache halves the
  query and the remainder is the always-fresh listing and its YAML parse.
- [x] `pnpm validate` green (210 vault-utils, 158 daemon, 187 desktop tests).
- [x] **Docs.** daemon.md (how the route answers now, and the numbers), LIMITATIONS (what is not
  indexed, and what the index costs in memory).

### Done — the list windows itself (virtualization, Phase 8)
- [x] **The change.** `NoteList` windows itself above 50 notes (`VIRTUALIZE_ABOVE`): the scroll
  container is handed to `@tanstack/react-virtual`, each row measures itself as it renders, and
  only the visible window plus an overscan of eight is in the DOM. Below the threshold nothing
  changed - a small vault needs no machinery and gets none, which is also why every existing
  component test kept passing untouched. The row itself moved into one `rowBody` both paths
  share, so the windowed and the plain list cannot drift apart.
- [x] **Tests, red first.** Sixty notes put a *window* of rows in the DOM - not sixty - with the
  first row present; three notes still render all three. jsdom has no layout, so the test gives
  the scroll container a `clientHeight` and the rows an `offsetHeight`: the virtualizer's only
  two size inputs, read out of its source rather than guessed, and restored after the test.
- [x] **One suppression, documented.** oxlint's React-Compiler rule flags `useVirtualizer` as
  memoization-incompatible; the one-line disable sits beside a comment saying why - the library
  hands back functions the compiler must not memoize, and skipping the component is the correct
  answer the rule is asking for.
- [x] `pnpm test:e2e` 5/5 against the built bundle, `pnpm validate` green (187 desktop tests).
- [x] **Docs.** TODO, FEATURES, desktop.md, LIMITATIONS (what a windowed list cannot promise).

### Done — the panes stop jumping (subtle transitions, Phase 8)
- [x] Two keyframes in `index.css` - a 140 ms fade and a 160 ms slide-down - applied where things
  appear rather than arrive: each pane (the note list and viewer, the graph, the trash), the
  search palette, the bulk bar, and the status-bar notice. Note switches and hover colours were
  already instant and stay that way; the animations run on mount, so nothing replays while a
  pane is merely re-rendered.
- [x] Both keyframes live inside `@media (prefers-reduced-motion: no-preference)`: a system that
  asks for less motion gets none - the classes then match nothing and the UI is exactly as
  before. No new dependency; plain CSS next to the tokens it uses.
- [x] Verified by the suites rather than by eye: 185 desktop tests and `pnpm test:e2e` 5/5 - the
  classes change no structure, and the e2e run is what proves the built bundle still renders.
  How it *feels* is the one check only a person can make (same category as the `[!]` items).

### Done — bulk move, tag and archive from the list (Phase 7)
- [x] **The helper.** `src/lib/bulk.ts`: `runBulk` settles one write over many notes with
  `allSettled` - a refusal on one note (a name taken, a folder gone) never abandons the rest,
  and the daemon's own sentence travels back per failure, exactly as a single-note operation
  speaks. `bulkNotice` is the one sentence the status bar shows: what landed, and the first
  refusal when something did not. A non-Error rejection reads "unknown error" rather than
  whatever the socket said.
- [x] **The UI.** A checkbox per row (`Select <title>`) and a bulk bar that appears with the
  first selection: the count, a folder picker for move, a tag field (Enter or **Add tag**),
  **Archive**, and **Clear**. Archive is the note's existing `status: archived` - the vault
  gained no new concept. Leaving the notes pane drops the selection, so a bulk action can never
  be one pane-switch away from notes the person is no longer looking at; that clear lives in the
  view-change event, not an effect (the lint said so, and was right).
- [x] **Wiring.** The shell runs the chosen writes through the store's `refreshVault()` and
  reports `bulkNotice`; a refresh that fails after a landed bulk is a notice, not a silent
  success.
- [x] **Tests, red first.** Six cases over the helper (counts, refusals kept, the daemon's own
  sentences, single/plural wording) and three end-to-end through the real shell: archive exactly
  the selected notes with the notice and a spent selection, move through the folder picker, and
  a partial failure carrying the daemon's sentence. 185 desktop tests; `pnpm test:e2e` 5/5
  against the built bundle, whose list markup this change reworked.
- [x] **Docs.** TODO (Phase 7 closed), FEATURES, desktop.md, CHANGELOG.

### Done — the vault lives in a store, not in one component (zustand)
- [x] **The store.** `src/lib/store.ts` holds what the whole shell shares: the daemon read with
  its demo fallback (the graph is a separate read, so the notes survive a graph failure), the
  re-read after every save or file operation - which throws rather than speaking for itself, so
  the caller turns a failure into the status-bar notice - and the list's filters (folder, query,
  tag). What is *open* (the pane and the note) deliberately stays in the address from the router,
  and session-only UI state (notices, drafts, pane widths, recents) stays in the component: the
  store holds only what more than one place reads or re-reads.
- [x] **App onto it.** The eight `useState` slices and the two hand-rolled triple-read refreshes
  collapsed into store selectors and one `refreshVault()`; `saveActiveNote` and
  `createNoteAndOpen` now share the same re-read as the file operations instead of each carrying
  their own copy of it.
- [x] **Tests, red first.** `store.test.ts`: the daemon read, the demo fallback with its
  connection flag, the graph failing on its own, the re-read applying all three reads, the re-read
  *throwing* so a caller can notice it, and each filter changing only its own slice. The routing
  test now resets the store per case - a module-level singleton would otherwise leak one test's
  vault into the next. 176 desktop tests (168 before this, untouched), typecheck and lint clean.
- [x] **`pnpm test:e2e` 5/5** against the built bundle, and `pnpm validate` green.
- [x] **Docs.** desktop.md, roadmap (zustand done - the Phase 4 list is now closed), FEATURES,
  TODO, CHANGELOG. One new dependency: `zustand`, lockfile committed.

### Done — the pane and the open note are the address (TanStack Router)
- [x] **One route, two parameters.** `src/router.tsx` creates a TanStack Router over a single `/`
  route whose `validateSearch` carries `view` (notes/graph/trash) and `note` (`Folder/name.md`).
  `main.tsx` renders the `RouterProvider`; App reads both with `useSearch({ from: "/" })` and every
  pick navigates with `useNavigate`, so a reload, the back button and a pasted link all land on
  the same pane and note. `view=notes` is dropped from the address (a plain URL means the
  default), an unknown view value falls back to the notes pane, and a delete drops the deleted
  note's parameter so a stale link cannot reopen an empty pane. Filters, notices, pane widths and
  the rest stay plain React state - the address carries only "where you are".
- [x] **Tests, red first.** `App.routing.test.tsx` renders the whole shell through the router with
  a memory history: the plain root with an empty search, both deep links, the bogus-view
  fallback, a view change written into the address with the back button taking it back, and a
  picked note named in the address and unselected again. Six cases, written before `router.tsx`
  existed. The existing 162 desktop tests were untouched and stay green, and the five e2e smoke
  tests pass against the built bundle.
- [x] **The two bugs the loop caught, pinned.** An empty child list left the router with nothing
  to match `/`, so it rendered its own inline-styled "no match" stub instead of the app; and this
  version of `useSearch`/`useNavigate` reads `options.from` at runtime, so calling them with no
  argument crashes into the default error boundary. Both now fail loudly in the routing tests if
  they ever come back.
- [x] **Docs.** desktop.md (file list, planned structure, planned capabilities), roadmap (Router
  done, zustand still open), FEATURES (typed routing row), TODO (Phase 4 item checked), CHANGELOG.
- [x] **`pnpm validate`.** lint, format:check, typecheck, 528 tests, build; `pnpm test:e2e` 5/5
  against the built bundle. One new dependency: `@tanstack/react-router`, lockfile committed.

### Done — `/plan` asks the local model, instead of saying it isn't built
- [x] **The plan module.** `apps/daemon/src/plan.ts` grew `buildPlan()`, the one function between
  the command and Ollama. It loads the vault's 20 newest notes (one shallow listing pass, a
  1,600-character budget per note and across the prompt), builds a prompt naming the day, and
  posts one `POST /api/generate` - streamed, non-streaming answered - with a six-second timeout.
  An empty vault answers "there is nothing to plan from yet" *without a single request*, the same
  call `GET /link`'s title-only path makes for the same reason. Every failure is caught and turned
  into a sentence: nothing listening (name the address, say `ollama serve`), timeout, a model that
  is not pulled (say `ollama pull <model>`), a bad status, an unreadable answer. None of those
  sentences carry the socket's own words, and the prompt - built from note contents, the private
  data itself - is never logged.
- [x] **The config chain.** `ollamaUrl`/`ollamaModel` join the file settings with the existing
  validation vocabulary, `OLLAMA_URL`/`OLLAMA_MODEL` the environment, and both are refused when
  blank - the model name must be pulled as written. `server.ts` threads them into the handler, and
  `POST /plan` is only ever created from that one context, like `POST /link`.
- [x] **The tests, red first.** 13 cases in `plan.test.ts` (prompt contents, ordering, caps, the
  empty vault, and each failure sentence against a mocked fetch), plus the `/plan` route and the
  injected-handler dispatch. The clock in those tests is built from local date components, so the
  day asserted in the prompt is the same in every timezone the suite runs in.
- [x] **Live, against a real daemon.** Ollama is not installed on this machine, so the model's
  answer itself is only proven by the injected-fetch tests - honestly reported rather than implied.
  What was exercised live is the path every machine without Ollama takes, end to end: a daemon on
  a temporary vault with `OLLAMA_URL` pointed at a port nothing answers on, and `POST /plan
  tomorrow` over HTTP. The reply was "I couldn't reach the Ollama model at
  http://127.0.0.1:19999/ - start it with `ollama serve`." - the exact address the environment
  named, proving config → server → app → handler → plan without a mock in the chain. The second
  live check was the empty vault: "There is nothing to plan from yet - capture a few notes
  first...", and the daemon log shows no Ollama request at all.
- [x] **Docs.** daemon.md (modules, commands, config, env, tests, planned paragraph), README,
  FEATURES (out of planned, into done), roadmap (✅), PLAN (no client library, the model question
  answered, open question closed), LIMITATIONS (what a small local model can and cannot promise),
  TODO (the Phase 3 open item is closed).
- [x] **`pnpm validate`.** lint, format:check, typecheck, 522 tests (204 vault-utils, 156 daemon,
  162 desktop), build - one run over the final tree, 13 more than the previous entry.

### Done — the link pane reads a PDF, and files that arrive without a useful type
- [x] Phase 5's last open item: `GET /link` refused every non-HTML content type with its type
  named, so a PDF link - a paper, a report, a spec - was a dead end. The fetcher now classifies
  the response before reading it: HTML/XHTML/plain text and an empty type are read as pages as
  before, `application/pdf` is parsed, `application/octet-stream` (and `binary/octet-stream`) is
  judged by its first bytes - `%PDF-` magic or a doctype - and anything else (video, JSON,
  archives) is still refused with its type named *before* its body is downloaded, so the old
  fast refusal did not turn into a wasted download
- [x] The reader had to become byte-based to do it: a PDF is not decodable as UTF-8, so
  `readCapped` reads bytes and the branch that knows what it holds does the decoding. Pages are
  capped as they were (1 MiB, 6,000 characters); a PDF gets 10 MiB because documents are read
  whole far more often than pages, and its text lands in the same cap and the same card
- [x] `read-pdf.ts` is the daemon's first parser dependency: `unpdf` wraps pdf.js for serverless
  use - no worker, no canvas - which suits a headless local daemon. It states its own boundary:
  a failure becomes `PdfReadError` with the one sentence a person sees ("That PDF could not be
  read."), with the parser's actual error kept as the cause rather than swallowed. A scan with no
  text layer is not a failure - it reads as empty, and the pane already says a page had no
  readable text
- [x] A PDF's card title is its file name (`annual-report.pdf` → `annual-report`), not the
  document's metadata - predictable, testable, and honest about where it came from
- [x] 6 new fetcher tests replace the old "pdf is refused" one: extraction and the filename title,
  a PDF and an HTML file arriving as `application/octet-stream`, a binary that is still refused
  with its type named, a broken PDF's fixed sentence, and the 6,000-character cap. The route test's
  refusal fixture moved to `video/mp4`, since the daemon can no longer produce that message for a
  PDF. 28 fetcher tests and 143 daemon tests in total, typecheck clean
- [x] Found while making the cap test pass, and written down rather than papered over: this pdf.js
  build returns only text the document draws *inside its page box* - a fixture with one
  page-spanning line (what no real producer writes) was cut at the box edge, so the cap fixture is
  now wrapped lines like a real document. [LIMITATIONS.md](LIMITATIONS.md) names the boundary for
  real PDFs too: off-canvas text is not returned
- [x] Exercised against a running daemon on real URLs, not only injected fetches: W3C's dummy.pdf
  came back as `{ title: "dummy", text: "Dummy PDF file" }` through `GET /link`, and `example.com`
  still extracted its title and prose unchanged

### Done — the trash is a list you can empty, not only an undo
- [x] Phase 7's last open item: a delete's **Undo** only lived as long as its notice, so the first
  delete you made after any other notice left you with a file in `.trash` and nothing in the app
  that knew it was there. The vault's `.trash` is now readable (`listTrash()`) and removable
  (`emptyTrash()`) in `@lumos/vault-utils`
- [x] Each trashed entry carries the day and time it went, stamped in a `.deleted-at` file inside
  the entry folder rather than derived from the id: the id is a timestamp only when it was minted
  cleanly, so a counter-suffixed id (`…-000Z-1`) or an entry made by hand would have had no
  reliable way back to a date. `listTrash()` reads that stamp, skips an entry with no readable note
  in it rather than failing the whole listing, and a restore sweeps the stamp away with the rest
- [x] Two daemon routes: `GET /trash` answers the entries newest first (`{ "trash": [...] }`, an
  empty list rather than a `404`), and `DELETE /trash` removes every one and answers how many went.
  There is no parameter for a single entry - restoring is how one note leaves - so the command with
  no undo deliberately has no narrower form. A trash someone half-cleaned by hand is skipped rather
  than refusing the rest
- [x] A **Trash** tab in the sidebar's view switch, so it sits beside Notes and Graph rather than
  hiding in a note's menu. It lists each entry with its folder and when it went, offers **Restore**
  per entry (keeping it when a note has taken the name in the meantime, with the daemon's sentence),
  and **Empty the trash** takes two presses - the button, then a confirm that names the cost and
  offers **Keep them** - because it is the one action in the app with nothing to undo afterwards
- [x] What emptying costs is written down rather than implied: [LIMITATIONS.md](LIMITATIONS.md) no
  longer claims the trash cannot be listed or emptied, and instead names what is true - a local-first
  vault has no second copy to fall back on, and the links those notes carried go with them (the graph
  drops the edge rather than resurrecting a note to keep a link tidy)
- [x] Tests at both ends: 6 in `packages/vault-utils/src/index.test.ts` (listing newest first, the
  id-derived date from the stamp, a counter-suffixed id still reading its date, an entry with no note
  skipped, emptying, and an empty trash being a count of zero), 4 in `apps/daemon/src/app.test.ts`
  (an empty vault answering nothing, a delete listed and each entry restoring, an empty reporting the
  count and leaving the rest of the vault alone, plus a zero when there is nothing to remove), and 10 in
  `apps/desktop/src/components/TrashPanel.test.tsx` covering the listing and its empty state, a failed
  read, a restore that lands and one that is refused, the two-step empty, a refused empty that stays
  open, and Close
- [x] Exercised against a running daemon rather than only through `app.inject()`: a note deleted
  from the app, `GET /trash` naming it with the folder and time it went, a restore putting the same
  bytes back and reopening the note, then an empty taking the entry count to zero

### Done — an E2E smoke test drives the built app in a real browser
- [x] The Phase 0.1 gap: the components were covered in jsdom, but nothing proved the *built* bundle
  reached the daemon, or that the Markdown, highlighting and keyboard wiring survived bundling. A
  new `e2e/` workspace runs Playwright against a real Chromium
- [x] `e2e/playwright.config.ts` starts two servers and tears them down with the run: the daemon on
  port **3101** over a committed fixture vault (`e2e/fixtures/`, Inbox + Reading), and the desktop
  built with `VITE_DAEMON_URL` pointing at that daemon then served by `vite preview` on **4173**.
  `reuseExistingServer: false` on both, so a daemon a person left running cannot be silently tested
  instead of this one
- [x] 5 tests in `e2e/smoke.spec.ts`: the vault loads through the daemon (not the demo fallback), a
  second note opens with its Markdown and a highlighted `language-js` fence, a backlink is listed
  and followed, a tag chip narrows the list and puts it back, and `Ctrl+K` + `Enter` finds a note by
  body text. Every test also fails on any uncaught page error, so a crash cannot read as a pass
- [x] Two strict-mode collisions were found by the first run and fixed in the *spec*, not papered
  over: the status-bar phrase also sits inside a fixture note's excerpt, and a note row's excerpt
  quotes the `[[...]]` link to another row's title. Both locators are now scoped or anchored
- [x]  `pnpm test:e2e` runs it from the root; CI runs it as a **second job** in
  `.github/workflows/validate.yml` (`pnpm test:e2e`), because it needs a browser binary and its own
  build. `pre-push` stays `pnpm validate` - the e2e suite is CI-enforced, not pushed-locally, so a
  contributor is never blocked on a browser download
- [x] Branch protection on `main` updated to require **both** checks (`pnpm validate` and
  `pnpm test:e2e`), so the new suite is enforced rather than only reported. `strict` stays on;
  `enforce_admins` remains off, which [LIMITATIONS.md](LIMITATIONS.md) already names
- [x] `oxlint` now lints `e2e` too, and `e2e` is a workspace package so `pnpm typecheck` covers it
- [x] Verified locally: `pnpm --filter e2e run test:e2e` - 5 passed in 12.6s against the running
  daemon and built bundle

## 2026-10-23

### Done — the editor shows what the draft renders as
- [x] The last thing a person could not see before saving was the rendering itself: a table that did
  not parse or a fence that swallowed the rest of the body only showed up after the write. The
  editor's right half now renders the draft on every keystroke (`src/components/NoteEditor.tsx`)
- [x] The pipeline is now one component, `src/components/Markdown.tsx`, which the reader and the
  preview both render with. A second renderer would have been a second set of rules, and a preview
  that disagreed with the saved note is worse than no preview at all
- [x] **Hide preview** / **Preview** hands the textarea the whole pane and brings the rendering back;
  the button carries `aria-pressed`, so the state is on the control rather than in its label alone.
  The panes scroll independently - there is no scroll sync, because the two are read for different
  things - and an empty draft says "Nothing to preview yet." instead of leaving a blank pane
- [x] Below the `md` breakpoint the panes stack, preview under textarea, rather than squeezing prose
  into half a column; the cost of a redraw per keystroke on a very large note is written down in
  [LIMITATIONS.md](LIMITATIONS.md) along with the stacking rule
- [x] 3 new tests in `src/components/NoteEditor.test.tsx`: the rendered heading and list follow the
  typing, the toggle hides and restores the pane with its `aria-pressed`, and an empty draft says so
- [x] `pnpm validate` green - 480 tests: 198 vault-utils, 133 daemon, 149 desktop
- [x] Checked in the running app against the daemon: typing a heading and a table in the editor
  re-rendered the preview as it went, **Hide preview** gave the textarea the full width, and the
  saved note read back identically
- [x] Two stale claims in [LIMITATIONS.md](LIMITATIONS.md) and [desktop.md](desktop.md) were corrected
  on the way: "notes cannot be renamed, moved or deleted from the app" and the note that tags and
  status are not editable were both written before those features landed

### Done — tags and status are editable in the app
- [x] Tags were write-once and WhatsApp-only: a hashtag in a message became a tag, and nothing in the
  app could add, remove or rename one - even though the filters, the graph and the palette all read
  them. The strip under the note header (`src/components/NoteMeta.tsx`) shows each tag as a chip with
  an **×**, adds one from a field, and picks a status
- [x] `PATCH /note/meta` and `updateNoteMeta()` write only the frontmatter block, so the body is
  byte-identical afterwards. The block is parsed as the file has it rather than through `parseNote`,
  so a key another tool wrote survives; tags are cleaned the way the graph reads them (no `#`,
  lower-case, de-duplicated), so a tag typed here and a graph node are one thing
- [x] A block that does not parse is refused (`400`) instead of replaced, because rewriting broken
  YAML would throw away what the person wrote. The block is re-serialised, so a comment or a
  hand-chosen key order in it is not kept - that trade is written down in [LIMITATIONS.md](LIMITATIONS.md)
- [x] The strip sends the whole tag list, not a delta, so two quick edits cannot disagree about what
  the list is; a refusal stays on screen with the daemon's sentence and the typed tag still in the
  field. With the daemon down the strip is read-only and says why
- [x] 17 new tests: 7 in `@lumos/vault-utils` (the cleaning and de-duplication, the body untouched, a
  foreign key surviving, the creation stamp kept, a file with no block, a block that does not parse,
  an empty status and a missing note), 4 in the daemon (the tag write, a status-only write, every
  `400`, the `404` and the unreadable block) and 5 in the desktop (a chip removed, a tag added and
  normalised, the status picker, a refusal kept, and the read-only strip)
- [x] `pnpm validate` green - 477 tests: 198 vault-utils, 133 daemon, 146 desktop

### Done — a delete can be taken back
- [x] The delete was the only irreversible thing the app could do, and it said so in the panel. It no
  longer removes anything: `deleteNote()` moves the note to `.trash/<id>/<folder>/<name>` and answers
  the entry - the id, the folder and name it came from, and when it went
- [x] `.trash` is a dot-folder, so the note listings, the folder counts and the graph skip it without a
  new rule; the trashed note is still a plain Markdown file a person can open in a file manager. An id
  is the ISO timestamp of the delete, with a counter if two land in the same millisecond
- [x] `POST /note/restore` and `restoreNote()` take only the entry id, because the entry already holds
  where the note lived - an undo cannot be aimed at a different note. The entry is removed once the
  file is home, so an id works once
- [x] The status bar carries the undo: **Undo** appears beside the notice, the note comes back under
  its old name and opens again, and dismissing the notice drops the offer. A restore whose old name is
  taken again is a `409` and the trashed copy stays put
- [x] 13 new tests: 6 in `@lumos/vault-utils` (the entry and its bytes, two deletes in one millisecond,
  the trash staying out of the listing and the graph, a refused delete writing no entry, the restore
  with its cleanup, a name taken again, a missing entry and an id that could leave the trash), 4 in the
  daemon (the delete's answer, the restore, the `409`, the `400`/`404` and the refused id) and 3 in the
  desktop (the status bar's notice, its action, and a notice that offers none)
- [x] `pnpm validate` green - 461 tests: 191 vault-utils, 129 daemon, 141 desktop. The round trip was
  also run against a real daemon: delete from the app, the file in `.trash` with the same sha1, the
  list at 0, Undo, the same sha1 back in `Ideas/`, the note reopened and the graph back to one node

### Done — a note's file can be renamed, moved and deleted
- [x] Creating and editing a note were both possible; its file was not. The **...** button in the
  note header opens `src/components/NoteActions.tsx` with **Rename**, **Move** and **Delete**, so a
  note filed in the wrong folder or named badly no longer means opening a file manager
- [x] Rename takes a title, not a filename, because the title is what the app shows. The daemon
  renames the file to `<date>-<slug>.md` - keeping the `YYYY-MM-DD-` prefix it already had - and
  rewrites the body's first `# heading`, so header, list row and filename agree afterwards. A note
  with no heading has no title of its own, so only its filename changes
- [x] Move keeps the filename: the date in it belongs to the note, and a move is about where a note
  belongs rather than what it is called. The list switches to every folder afterwards, because the
  filter you were looking through would otherwise hide the note you just moved. Delete asks first
  and says there is no undo
- [x] Nothing is ever overwritten. A target name another note holds is a `409` and both files survive,
  which is why a rename refuses instead of appending a timestamp the way capture does: the person
  asking is right there and can pick another title. Every path is resolved against the vault root
  before a file is read, moved or removed
- [x] `PATCH /note`, `POST /note/move` and `DELETE /note`, plus `renameNote()`, `moveNote()` and
  `deleteNote()` in `@lumos/vault-utils`. A refusal is `400` for an unsafe path, `404` for a note
  that is not there, `409` for a collision - carried by `NoteFileError` and its `reason`, so a route
  maps it to a status instead of guessing from an error message. The CORS allow-list gained `PATCH`
  and `DELETE`, which the preflight test asks for by name
- [x] A failure keeps the panel open with the daemon's own sentence, and the listing, folder counts
  and graph are re-read after an operation - a new filename is a new key, and a new heading changes
  the title the graph draws. A refresh that fails is a status-bar notice, not a failed rename
- [x] The panel warns when other notes link to the old title, because their `[[links]]` are not
  rewritten. That gap and the missing undo are now on the open list in [TODO.md](TODO.md)
- [x] 43 tests: 17 in `@lumos/vault-utils` (the move and its bytes, the created folder, the
  collision, the same-folder no-op, the rename with its heading and date prefix, a `#` line in the
  frontmatter not being the title, an empty title, a missing note and a path that escapes the vault),
  13 in the daemon (both routes and the delete, every refusal, both `409`s, the no-op rename and the
  preflight) and 13 in the desktop (the menu, the rename and its refusal, the link warning, one
  rename at a time, the folder list, the delete that asks, and the header offering the operations
  only while the daemon answers)
- [x] `pnpm validate` green - 434 tests: 173 vault-utils, 124 daemon, 137 desktop
- [x] Exercised against a temporary vault through the running app, not only in the suite: a note was
  renamed, moved and deleted from the panel while the files on disk followed, and a rename that
  collided was refused with the daemon's sentence and left both notes alone. Nothing touched `vault/`

### Done — a rename carries the links that point at it
- [x] The rename shipped, and left the obvious hole open: links resolve by title, so renaming a note
  broke every `[[old title]]` pointing at it and the graph started reporting them as unresolved.
  Now `renameNote()` rewrites them in the same operation and answers the files it edited as `updated`
- [x] The rules are the graph's own, not a second copy: `linkResolver()` is the resolver
  `buildGraphFromNotes()` already used, exported so a rename can ask "what does this link point at?"
  with the aliases, slugs and filename forms that answer already had, and `rewriteLinks()` swaps one
  target in place. Both are pure and live in `@lumos/vault-utils/graph`, so the desktop could use them
- [x] A rename is compared against the vault as it *will* be: a target is rewritten only when it
  reaches the note now and would not afterwards. So a link written to a frontmatter alias keeps the
  author's wording, because the alias survives; a link inside a code fence or inline code is not
  touched, because the graph does not read it as a link; and a note's link to its own old title is
  left to its own body, which is only retitled. The three exceptions are in [LIMITATIONS.md](LIMITATIONS.md)
- [x] The link keeps its shape: `[[Learn Rust]]` becomes the new title while
  `[[2026-10-20-learn-rust.md]]` becomes the new filename, a `#heading` and a `|alias` stay, an embed
  keeps its `!`, and a markdown `[text](file.md#anchor)` keeps its text and anchor
- [x] The desktop says it happened rather than doing it silently: the rename panel states that links
  here are rewritten too, and the status bar reports "Renamed; 2 notes link to the new title."
- [x] 13 tests: 12 in `@lumos/vault-utils` (the resolver, the four link shapes, headings and aliases
  surviving, code left alone, the alias link left as written, and nothing touched when the title is
  unchanged) and 1 in the daemon (the route answering the file it edited). Suite is 447: 185
  vault-utils, 125 daemon, 137 desktop

## 2026-10-22

### Done — a note can be created from the desktop
- [x] The editor could rewrite a note that existed; nothing could make a new one, so an empty vault
  could only be filled from WhatsApp. **New** in the note list opens a composer in the list's own
  pane - a folder picker and a textarea - and Create (`Cmd/Ctrl+Enter`) files it and opens it.
  Enter stays a newline, because the textarea is a textarea first
- [x] The composer reuses the capture writer rather than growing a second one: the first line is the
  title, `#hashtags` become tags, and the filename is the usual `YYYY-MM-DD-slug.md`, so a note
  typed here and a note captured on a phone are the same shape of file. The allowlist does not
  apply - that belongs to WhatsApp, not to the machine you are sitting at
- [x] The one difference is `source: desktop`. `saveNote()` took the source as an option defaulting
  to `whatsapp`, so the capture path is unchanged. The field is shown to the person reading the
  note, and a note that claims the wrong origin is worse than one that says nothing
- [x] The folder starts where the list is looking (Inbox when it is showing all), because a new note
  usually belongs where you already are. A failed create keeps the draft and shows the daemon's own
  sentence, exactly as a failed save does
- [x] `POST /notes` on the daemon, beside `PUT /note`: a missing folder, a missing text or text that
  is only spaces is a `400`; a folder outside the known set is a `400` and nothing is written
  anywhere; a second note with the same text gets its own file
- [x] After a create the listing, folder counts and graph are re-read and the new note is opened by
  the key the daemon answers, so "created" is a result rather than a submission
- [x] 14 tests: 1 in `@lumos/vault-utils` (the source, defaulting to WhatsApp), 5 in the daemon
  (the create and its origin, the listing after it, every bad payload, the unknown folder leaving
  the vault untouched, and never overwriting) and 8 in the desktop (the folder list, the create,
  the failure keeping the draft, `Cmd/Ctrl+Enter`, a plain Enter staying a newline, one create at a
  time, and cancel). Suite is 391: 156 vault-utils, 111 daemon, 124 desktop
- [x] `pnpm validate` green - 391 tests: 156 vault-utils, 111 daemon, 124 desktop

### Done — a note can be edited and saved from the desktop
- [x] Until now only WhatsApp could write to the vault, which made a "second brain" a read-only
  archive. **Edit** in the note header turns the body into a textarea, Save (`Cmd/Ctrl+S`) writes it
  back, Cancel (`Esc`) drops the draft, and the toolbar says when there is something unsaved
- [x] Only the body is written and the frontmatter block is left character for character. The
  obvious alternative was to parse the note and re-serialize it, which would have silently rewritten
  a hand-edited block: repaired values, reordered keys, dropped comments. The reader already reports
  a broken block rather than hiding the note, so the editor has no business fixing one quietly
- [x] `PUT /note` on the daemon, `@lumos/vault-utils` `replaceNoteBody()` and `updateNote()`. The
  route shares every guard `GET /note` has - an unknown folder or an unsafe name is a `400`, a note
  that is not there is a `404` and never a create - and the write goes to a temporary file then a
  rename, so an interrupted save leaves the old note intact rather than truncated
- [x] An empty body is a real request (the text was deleted) and is told apart from a missing one,
  which is a `400`. Saving is the one place a mistake destroys data, so the name and folder are
  checked against the vault root inside `updateNote()` as well as in the route
- [x] A failed save keeps the draft and shows the daemon's own sentence above it - losing typing to
  a daemon that went away would be the one unforgivable outcome here
- [x] After a save the listing, folder counts and graph are re-read, because a new heading changes
  the title, a new `#tag` changes the tags and a new `[[link]]` changes the graph. When that refresh
  fails the status bar says so: the save already landed, and calling it a failed save would be a lie
- [x] The bug only the running app could show: `@fastify/cors` defaults to `GET,HEAD,POST`, so the
  browser's preflight refused the `PUT` and the editor said "Failed to fetch" while `curl` against
  the same route succeeded. The daemon now names the methods it serves, and a preflight test covers
  it - the suite had only ever asked with a `GET`
- [x] 28 tests: 13 in `@lumos/vault-utils` (the block surviving verbatim, a broken block still broken
  after a save, an empty body, a horizontal rule not mistaken for the end of the block, traversal
  refused on the folder and on the name, a missing file never created), 7 in the daemon (the save,
  the empty body, every refusal, `404`, other notes untouched, the preflight) and 8 in the desktop
  (draft, save, failure, `Cmd/Ctrl+S`, one save at a time, cancel, Edit offered only when reachable)
- [x] `pnpm validate` green - 377 tests: 155 vault-utils, 106 daemon, 116 desktop
- [x] Exercised in the running app, not just the suite: edited the body in the browser, watched the
  list row take the new title from the re-read listing, and confirmed the file on disk kept its
  frontmatter, its tags and its filename, with no temporary file left behind. Stopped the daemon and
  reloaded: demo notes render, Edit is disabled and its tooltip says why

### Done — the daemon reads a config file
- [x] Four settings in four environment variables was workable from a shell and awkward for anything
  that has to start the daemon itself. `loadConfig()` in `config.ts` reads `lumos.config.json`
  (`vaultPath`, `port`, `allowedNumbers`, `whatsapp`) with the environment overriding it, so
  `VAULT_PATH=... pnpm dev` still wins when a file exists
- [x] The decisions that mattered: a relative `vaultPath` resolves against the file that named it,
  not the working directory, so the same file means the same vault from any shortcut; a missing file
  is not an error; an unknown key is refused rather than ignored, because a typo that silently does
  nothing is the worst outcome for a setting; and a bad file stops the daemon with one sentence and
  exit 1 instead of a stack trace
- [x] `vault.ts` is deleted rather than left as a second source of truth, and the docs that listed it
  (module tables in this repo, `AGENTS.md`, both READMEs) now name `config.ts`
- [x] One behaviour the environment exposed: this shell sets `PORT=0` globally, which the old code
  would have used to listen on a random port without saying so. `PORT=0` is now refused, with a
  sentence that names the variable - a random port is one the desktop cannot find
- [x] 12 tests over precedence (env over file over default, per setting), resolution against the
  file's directory, normalising `+1 (555) 010-0000`, and every refusal: unknown key, bad port from
  either source, not-an-object, invalid JSON, wrong types, and an unreadable file (surfaced, not
  swallowed)
- [x] Exercised the process, not only the function: with the file served through `LUMOS_CONFIG`, the
  daemon listened on the configured 3111 and served the note from the file's relative vault; `PORT`
  in the environment moved it to 3112 and 3111 stopped answering; a `port: 70000` file and a
  `prot` typo each printed one line and exited 1
- [x] `pnpm validate` green - 349 tests: 142 vault-utils, 99 daemon (12 of them new), 108 desktop

### Done — the reader drops the page's chrome
- [x] The link pane's reader stopped carrying things nobody wrote. `toText()` in
  `packages/vault-utils/src/link.ts` now drops whole `<pre>` code samples, the page's `header`,
  `footer`, `aside`, `nav`, `form`, `dialog`, `button` and `select`, a line that repeats the line
  before it, and a line that is nothing but a bare bracketed lowercase label (`[ edit ]`)
- [x] One defect that measuring turned up and reading would not have: Wikipedia's `data-mw`
  attribute holds serialized template JSON containing a `>`, which ended the tag early and spilled
  the payload into the reader as one enormous line. `data-` attributes are never visible text, so
  they are stripped first
- [x] Measured before and after through `GET /link`, on pages that show both symptoms. MDN's
  `if...else`: 206 lines with 37 code-ish and 32 repeated, to 115 lines with 0 and 0. Wikipedia's
  Markdown article: it opened with "33 languages" and the language list, and carried the JSON blob;
  it now opens "From Wikipedia, the free encyclopedia" with 0 code-ish lines
- [x] 6 tests in `link.test.ts` for the behaviour rather than the byte count: a code sample leaving the
  prose around it intact, header/sidebar/controls/footer gone, a duplicated menu line collapsed, a
  bracketed label dropped, a `data-` payload dropped, and inline `<code>` in a sentence kept, since
  that is part of the sentence
- [x] The limit is written down rather than hidden: this is a string pass, not a parser, so a block
  nested in the same tag closes at the first end tag and chrome inside a plain `<div>` still comes
  through, and [LIMITATIONS.md](LIMITATIONS.md) says so
- [x] `pnpm validate` green - 337 tests (142 vault-utils, +6)

### Done — the desktop components have tests
- [x] jsdom and Testing Library are in the desktop workspace (`jsdom`, `@testing-library/react`,
  `@testing-library/dom`), which closes the gap that kept every panel's states on a manual check
- [x] The four components that carry state are covered: `Sidebar`, `NoteList`, `SearchModal` and
  `LinkPane`, 33 tests. Each file declares `// @vitest-environment jsdom` at the top, so the
  pure-logic suites keep running in Node and nothing global changed
- [x] The tests assert behaviour, not markup: which folder is marked active and what a click hands
  back, the loading and empty states including the one that names a tag, a row opening the note it
  belongs to, the badge and the reasons on a note with broken frontmatter, a tag chip switching a
  filter on and off, the palette's recent notes with the arrow keys and `Enter`, `Escape` closing
  it, a body match arriving marked "in the body", and the link pane's embeds, its reader states
  and a **Retry** that asks again
- [x] Two behaviours the tests settled rather than assumed. A page that the daemon refuses shows
  the daemon's own sentence (`GET /link -> 400`) and **Retry** costs a second request, because a
  failure is not cached. And with the daemon up, an empty local result reads "Searching…" until
  the body search answers - my first version of that test expected "No notes match" and failed,
  which is the test doing its job
- [x] The app still renders: the dev server on 1420 (already running, reused) showed the folder
  sidebar with its counts, the Notes/Graph tabs, "No notes here yet.", and the palette opening on
  `Ctrl+K` and closing on `Esc`, with no console errors
- [x] `pnpm validate` green - 331 tests (136 vault-utils, 87 daemon, 108 desktop, +33)

### Done — an unexpected failure answers a plain 500
- [x] The daemon has one error handler now (`app.setErrorHandler` in `app.ts`). The routes already
  answered their own refusals with a sentence naming the cause; what they did not anticipate went
  to Fastify's default handler, which puts the error's own message in the body. For a filesystem
  failure that message is the absolute path, so the reply said where the vault is. It now answers
  `500 { "error": "The daemon could not finish that request." }`
- [x] The detail is not thrown away, but it is not the message either: the log records the error's
  name and code (`ENOTDIR`) against the request id, since the message is the thing that carries the
  path. Neither the reply nor the log names the vault
- [x] A `4xx` Fastify raised itself keeps its own message - a malformed JSON body still says what was
  wrong with it - so the handler closes the leak without flattening the refusals that were already
  specific
- [x] Two route tests, and the first one provokes a real failure rather than a stub: the app is
  built over a vault path that is a file, so `GET /notes` reaches `readdir` and gets `ENOTDIR`. The
  test asserts the plain 500 and that the body carries neither the path nor the error code. The
  second posts a malformed body and asserts the `400` still names its cause
- [x] Exercised against a running daemon, not only through `app.inject()`: with `VAULT_PATH` set to a
  file, `GET /notes` answered `500` with the plain message and the log line carried
  `{"name":"Error","code":"ENOTDIR"}` and no path; with a real vault the same build answered
  `200` for `/notes` and `/folders` and `400 unknown folder` for a traversal attempt
- [x] `pnpm validate` green - 298 tests (87 daemon, +2)

### Done — the checklist reads in the order the work happens in
- [x] `TODO.md` is now ordered by standing rather than by phase: **Needs your testing** first,
  then **Plan**, then **In progress**, then **Done** last. The phase each item belongs to stays on
  the item, so the phases in `PLAN.md` still map onto it
- [x] The four checks that no unit test can close are at the top, each marked `[!]`: the Tauri
  shell, a live WhatsApp session, the social embeds inside the packaged window, and the graph's
  **Show notes** button, which needs a pointer hit the automation could not place
- [x] The open-ended items were split rather than left as one box that could never be ticked.
  "Richer error messages and logging" was two things: the refusals all name their cause (done),
  and a route that throws for an unexpected reason still answers with the raw error message, which
  for a filesystem failure carries the vault path (open). "UI polish" was the empty, loading and
  error states (done - every panel has them) and the transitions (open - only hover colours
  transition today). "Performance" was the lazy graph renderer and the once-per-load search index
  (done) against list virtualization and a daemon-side index (open). "Complete docs" was the docs
  themselves (done) against the screenshots and a standalone `USAGE.md` (open)
- [x] The Fastify behaviour behind that first item was measured rather than assumed: a route that
  throws answers `500` with the error's own message in the body, so the plan item is written
  against a fact rather than a guess
- [x] `FEATURES.md` was regrouped the same way - what is planned and only an idea first, then what
  is in progress, then what is done
- [x] The two "Next up" lists left open in this log are annotated with what each item became, so
  the log does not leave a promise open that has been kept
- [x] Stale claims found and corrected: `desktop.md` still listed every keyboard shortcut and the
  recent-notes palette under "Planned capabilities" after both shipped, `design.md` said the panes
  were not resizable and the search modal was not wired up, and the roadmap's "Beyond" paragraph
  still offered the backlinks panel and the tag nodes as if they were outstanding
- [x] One formatting defect fixed: two bullets in the 2026-10-20 entry had run together on one
  line, so the browser check of the backlinks panel was part of the unit-test bullet
- [x] `pnpm validate` green, and every internal link in `docs/` still resolves

## 2026-10-21

### Done — a broken note is reported, not hidden
- [x] Phase 0.1's schema validation, as far as it can honestly go: `validateFrontmatter()` checks the
  four fields the app depends on (`created`, `tags`, `source`, `url`) and lets every other key
  through, because frontmatter is meant to grow
- [x] The defect was real, not theoretical: `parseNote` called `YAML.parse` without a guard and then
  spread the result into the frontmatter, so invalid YAML threw and the listing swallowed the error,
  and a block that was a list spread its indices into the object. Both shapes made a note vanish
  from the app with nothing said. The body is now read anyway and the reason is carried with it
- [x] A field keeps the value that was written rather than being repaired: a `created: soon` is
  reported and shown as an empty date instead of being replaced with now, so the file says what is
  wrong instead of quietly sorting somewhere else
- [x] `Note.problems` is always present; `VaultEntry.problems` only when there is something to say,
  so a clean listing is byte-identical to before and the demo vault needs no change
- [x] The viewer shows the reasons above the body and keeps rendering the note; the list marks the row
  `! frontmatter` with the details in its tooltip
- [x] 20 tests in `@lumos/vault-utils` (12 for the rules, 8 over parsing and listing), 2 route tests in
  the daemon and 3 render tests for the warning. Suites are 136 / 85 / 75, so 296 in `pnpm validate`

### Done — the note list can be resized
- [x] Phase 4's resizable panes: a `PaneSplitter` between the list and the viewer, draggable with the
  pointer, reset on double-click, and steppable with `←`/`→`/`Home` from the keyboard
- [x] It is a real `separator`: `aria-orientation`, `aria-valuemin`/`max`/`now`, and an
  `aria-valuetext` in pixels, because a resize handle that only works with a mouse is not finished
- [x] The bounds (240-560px) and the clamping live in `src/lib/pane-size.ts` with 7 unit tests, so the
  drag and the keys cannot disagree; a non-number falls back to the default rather than collapsing
  the column to nothing. Desktop suite 72, total 271
- [x] The width is held in `App`, not in `NoteList`: the Graph tab unmounts the list, and a width that
  reset every time someone looked at the graph would be worse than no splitter at all
- [x] The drag listens on the window rather than the 8px handle, because the pointer leaves that
  target almost immediately; a right-click is ignored instead of starting a drag
- [x] Verified in the browser against a temporary vault: the default measured 320px with the viewer at
  888px; two `→` presses gave 352/856; five `←` presses stopped at 240 and a sixth changed nothing;
  `Home` returned to 320; a simulated pointer drag of +120px gave 440/768 with `col-resize` set during
  the drag and cleared after; double-click reset it to 320; and switching to the Graph tab and back
  kept 440, which is the case a component-local width would have failed
- [x] One stray code fence in `docs/desktop.md` found while editing the layout diagram and removed

### Done — j/k through the note list
- [x] The note list takes `j` and `k` in the Notes view: clamped at both ends rather than wrapping, and a
  step is an ordinary pick, so it also feeds the palette's recent notes
- [x] The handler stands down while a field has focus or the palette is open, which is the defect this
  kind of shortcut usually ships with - a search box that cannot be typed into
- [x] `src/lib/list-nav.ts` holds `stepIndex`/`stepForKey`/`isTypingTarget`, with 8 unit tests; the
  typing rule is duck-typed on `tagName` so it is testable in Node and needs no jsdom. Desktop suite
  65, total 264
- [x] Verified in the browser against a temporary vault of four notes: `j` from the first note walked
  to the second, third and stopped at the fourth on a fifth press; `k` at the top stayed put; typing
  `j` into the note search box put `j` in the field and filtered the list instead of moving the
  selection, and the same held with the palette open (`j` landed in its query, the note behind it
  stayed put)

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
  tag node itself, de-duplication of a note that links twice, and an unknown id
- [x] Verified in the browser against a temporary vault: three notes, two linking to the third, the
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
- [x] Branch protection turned on for `main`: the CI checks are required, `strict` is on so a stale
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
- [x] Turn on branch protection on `main` so the green `pnpm validate` check is required to merge — done 2026-10-19
- [x] Link pane: keep a scraped page for the session (it refetches when the note is reopened, and twice in dev under StrictMode) — done 2026-10-20
- [ ] Link pane: strip site chrome harder — the reader still carries code samples and repeated navigation text from some pages — still open, under **Plan** in [`TODO.md`](TODO.md)
- [x] Frontmatter schema validation, and reporting a malformed note instead of skipping it silently — done 2026-10-21
- [x] `/help` does not list itself in the command list it prints — done 2026-10-19

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
- [x] Turn on branch protection on `main` so the green `pnpm validate` check is required to merge (the workflow itself runs on every PR and every push) — done 2026-10-19
- [x] Route tests for the read API (needs a Fastify factory extracted from `server.ts`) — done 2026-10-16
- [x] Tag filtering + syntax highlighting for fenced code — done 2026-10-19 and 2026-10-20
- [x] Graph follow-ups: a backlinks panel in the note viewer, tag nodes styled and clickable apart from notes — done 2026-10-20
- [x] Resizable panes, TanStack Router, zustand — the panes are done 2026-10-21; TanStack Router and zustand are still open, under **Plan** in [`TODO.md`](TODO.md)
- [x] Phase 3: link expansion, `/plan` with Ollama, tagging — link expansion and tagging are done; `/plan` with Ollama is still open, under **Plan** in [`TODO.md`](TODO.md)

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
