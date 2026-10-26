# Lumos - Known limitations

What Lumos does not do, or does partly, written down in one place. This is the honest list, not a
backlog: [TODO.md](TODO.md) holds the work someone intends to do, and this file holds the things that
are true today — including the ones nobody has scheduled. An entry here is a decision or a known gap,
so if you hit one of these, it is not a surprise bug.

Each entry says what is given up. Where a limit is deliberate, the alternative is named.

## Link playback and the reader

- **Only YouTube, Vimeo, Instagram and Facebook play inline.** Every other media URL is not
  recognised as media: a direct `.mp4` or `.webm` link is treated as a page, fetched, and then refused
  with its content type, so there is no `<video>` element for it and no `<audio>` support at all. The
  Instagram and Facebook limits are their own section below, because they are different in kind -
  those two play through the platform's embed, not from a URL the app can build for itself.
- **Age-restricted, region-blocked, rented or DRM-protected videos fail inside the player.** The
  embed refuses them with its own message; Lumos does not detect that state, so the pane looks normal
  and the failure belongs to YouTube.
- **Playback needs the network.** The embed is loaded from `youtube-nocookie.com` on every open.
  Nothing is downloaded or cached, so playback does not work offline and a video is not part of the
  vault.
- **A playlist or channel URL is a page, not a video.** `/playlist?list=…`, `@channel` and a `watch`
  URL with a malformed id all fall through to the reader.
- **The reader is text.** Layout, in-body images, tables, code formatting, footnotes and math are not
  reproduced: the extraction flattens structure into lines. It leaves out what is not prose - the
  chrome elements (`nav`, `header`, `footer`, `aside`, `form`, `dialog`, `button`, `select`), whole
  `<pre>` code samples, a line that repeats the one before it, a bare bracketed label such as
  `[ edit ]`, and the payload of any `data-` attribute - but it is a string pass, not a parser: a
  block nested inside the same tag closes at the first end tag, chrome that sits in a plain `<div>`
  still comes through, and a page whose whole article is inside an `<aside>` would read as empty.
- **Text is capped at 6,000 characters.** Past that the pane says so and offers the real page. There
  is no "load the rest" path, and no way to raise the cap from the UI.
- **JavaScript-rendered pages come back nearly empty.** Only the initial HTML is fetched — no browser,
  no script execution — so a single-page app reads as a shell. Paywalled, login-only and interactive
  pages are in the same place.
- **A PDF is read as text, with the limits that follow from that.** The reader takes the text a
  PDF contains (up to 10 MiB, then capped like any page at 6,000 characters), so a scan with no
  text layer reads as "no readable text", an encrypted document is refused with its reason, and
  text the document draws outside its own page box - content some producers hide off-canvas - is
  not returned at all. A PDF's card title is its file name, not the document's metadata. Everything
  else that is not a page - JSON, video, archives - is still refused and named by its content type.
- **`/plan` needs a running Ollama with its model pulled, and says so instead of planning.** The
  reply is only as good as a small local model reading the vault's 20 newest notes: there is no
  fine-tuning, no memory of earlier plans, and no asking for more than five points. This
  repository has no Ollama to judge the quality of what comes back - only the wiring around it is
  tested, and that wiring was exercised live against a real daemon. The day it plans for is the
  machine's own, and a note outside the newest 20 is not in the prompt at all.
- **The note list windows itself above 50 notes, so the DOM stops at the window.** Rows beyond it
  are not rendered until they scroll into view, and `j`/`k` past the window moves the highlight
  without guaranteeing the row is on screen yet - the list has never auto-scrolled, so the
  scrollbar is how a person follows. Below 50 notes nothing is virtualized and every row is
  exactly as it was.
- **A page is cached for the session, not refreshed.** The first read of a URL is kept in memory
  (`src/lib/link-cache.ts`), so reopening a note, switching tabs and StrictMode's double mount all
  reuse one request and one scrape; a second caller while the first is still in flight joins it
  instead of starting another. Nothing has a TTL, so a page that changed since the session started
  is still shown as it was, and there is no per-page Refresh — only a reload, which empties the
  cache. A refusal or a network failure is deliberately not remembered, so Retry makes a real
  request.
- **The reader is a snapshot, not a copy.** Scraped text is never written to the vault, so it is not
  searchable, not linked by the graph, and not preserved if the page disappears.
- **Local addresses are refused on purpose.** `localhost`, `*.local`, `*.internal`, loopback, private,
  link-local, CGNAT and reserved addresses cannot be opened through `/link` — including your own
  local dev server — because the endpoint would otherwise be a way for a link (or a WhatsApp message)
  to reach services on your machine.
- **Container-style rebinding is not defeated.** The hostname is resolved and every answer checked
  before the request, but a name that resolves publicly and then moves — between the check and the
  connection — is a known gap, because the fetch does not pin the checked address. Accepted for a
  personal, loopback-only daemon; it is not accepted for a shared one.
- **An unusual IP literal is treated as a hostname.** A form `net.isIP` does not recognise is resolved
  through DNS, and refused when it does not resolve — fail closed, but the message reads as
  "could not be found" rather than "refused".
- **`/link` is unauthenticated on loopback.** Any local process can ask the daemon to fetch a public
  URL. It cannot reach private addresses, and the URL is never logged, but outbound requests on your
  behalf are possible.
- **The URL itself is not shown for a scraped page** beyond the note's own header and an "open" link,
  so it is easy to lose track of which page a card came from when it redirected.

## Social embeds (Instagram, Facebook)

An Instagram or Facebook link is shown through the platform's own embed, which is the only way to
play it — neither page can be read or copied.

- **Only public content, and only where the account allows it.** Private, inactive and age-restricted
  accounts, accounts with embeds turned off, and Stories cannot be embedded at all. The frame shows
  the platform's own message; Lumos cannot tell that apart from a reel that was deleted.
- **An unavailable permalink still answers HTTP 200.** Instagram serves its "Unavailable" page with a
  success status, so nothing can be validated before the frame loads, and a dead link and a private
  one look identical.
- **The reader gives nothing for these two hosts.** Their pages are JavaScript shells, so the readable
  text is empty (measured: 0 characters for a public reel, where the caption instead arrived in the
  page title). A social link is therefore a player plus a metadata card, never text in the vault.
- **The caption and thumbnail depend on the daemon.** They come from the page's own meta tags, fetched
  by `/link`. With the daemon stopped the embed still plays, but the caption, site and thumbnail are
  gone and the pane says so.
- **What those meta tags say is the platform's choice.** A Facebook video answered with a mixed-locale
  title (Urdu and English in one string) during testing, because the crawler is served whatever
  Facebook picks for it. There is no request-language header and no normalisation.
- **Nothing is downloaded.** The embed is loaded from `instagram.com` / `facebook.com` on every open,
  so playback needs the network, the platform sees the request, and no copy of the media is kept. A
  reel in a note is a link, not part of the vault.
- **Share links and short links are not recognised.** `/share/…`, `/share/r/…` and `fb.watch/…` are
  classified as ordinary pages, because their real target is only known after a redirect; they get the
  reader, which returns nothing for them.
- **The Instagram captioned embed scrolls.** Its own document is taller than any sensible frame (it
  wraps the video, the account header and the caption), so the frame is scrollable rather than exactly
  sized.
- **Which Facebook shape you pasted decides the plugin.** A video/reel/watch URL goes to the video
  player, a post or photo URL to the post card. A URL that is neither falls back to the reader.
- **Tested in Chromium, not in the Tauri window.** The embeds were verified by hand in both shapes
  (a reel and a video, each playing logged out) and a post embed; the same check inside the packaged
  app is still manual, like the rest of the Tauri shell, and is listed under **Needs your testing**
  in [TODO.md](TODO.md). Embedding is the platform's to change — a plugin URL could stop working
  without notice, and no test can fail to warn you.

## Capture (WhatsApp)

- **Baileys is an unofficial WhatsApp Web client.** An account can be banned for using it, which is
  why the README suggests a spare number. This is a risk of the approach, not a bug to fix.
- **The live WhatsApp session is not tested.** The parser, the filing path, `/find` and the read API
  have tests; the Baileys connection has none — it needs a real linked device and would be flaky in
  CI. The manual check for it is a QR link followed by a real message, and it is listed under
  **Needs your testing** in [TODO.md](TODO.md).
- **Messages during a disconnect are lost.** Reconnection backs off and retries the socket, but there
  is no queue and no replay, so a message sent while the daemon is down is simply not captured.
- **The app can stop the link but not unlink the phone.** **Disconnect** closes the socket and keeps
  the pairing in `apps/daemon/auth_info/`, so **Connect** needs no code; taking the device off the
  account is WhatsApp's own **Linked devices > Log out**, and nothing running here can do it on a
  person's behalf. The daemon notices the unlink and reports `logged-out`, and the panel says so.
- **The link's state is polled, not pushed.** The status bar reads `GET /whatsapp` every 15s and the
  panel every 3s, so a drop shows up a few seconds late, and a pairing code on screen can be a few
  seconds old - `waiting` is re-read often enough that it rotates with the code, but a panel left open
  on a paused daemon still ages. There is no server-sent event and no websocket for it.
- **Capture being switched off is a startup setting.** A daemon started with `LUMOS_DISABLE_WHATSAPP=1`
  or `whatsapp: false` reports `off` and refuses `POST /whatsapp/connect` with a `409`; the app cannot
  switch capture on for a process that was started without it.
- **The allowlist is an exact number match.** There is no per-chat or per-command permission, and an
  empty `ALLOWED_NUMBERS` blocks everything (a deliberate default).
- **A URL in a plain message is stored, not fetched.** Link expansion happens when the desktop opens
  the note; the WhatsApp reply never includes the page title.
- **There is no command autocomplete while you type.** That is WhatsApp's side, not the daemon's: a
  chat with this account is a chat, and nothing in it can suggest `/movies` as you type. A bare `/`
  is the substitute - it answers with the menu, built from the folders on disk - so the commands are
  one message away instead of remembered.

## Desktop

- **The Tauri shell is untested by CI.** Only the web UI is exercised (in a browser). The Rust side,
  the window configuration and the packaged bundle are manual checks: `pnpm --filter desktop tauri dev`.
  The check is listed under **Needs your testing** in [TODO.md](TODO.md).
- **No end-to-end test.** The sidebar, note list, search palette and link pane are now covered as
  components in jsdom, and the viewer through SSR renders, but nothing drives the built app in a
  real browser: a broken route, a chunk that fails to load or a bad Tauri bundle would not be
  caught. The graph canvas is the one component with no test at all, because it draws through the
  graph library and jsdom cannot render it. An E2E runner is tracked under **Plan** in
  [TODO.md](TODO.md).
- **The palette runs four commands, and only while the daemon answers.** Writing a note, making a
  folder, the graph and the trash. It does not yet offer "new note in *this* folder" per folder, a
  move or a tag of the open note, or a command history; a palette that listed everything would be a
  menu with a text box on top, so the set stays the ones there is nothing else for.
- **Only the fields a control owns can be edited.** A body, tags, status, the filename and the folder
  each have something in the app that writes them. `created`, `url`, `source` and any key another
  tool put in the block do not: there is no form for the frontmatter as a whole, and nothing here
  offers an input that would silently do nothing.
- **A draft belongs to the note that was open.** Opening another note while editing closes the editor
  and drops what was typed, because there is no draft store and no "unsaved changes" prompt on
  navigation. The draft does survive a failed save. There is also no undo, no edit history and no
  conflict detection: if the same file is changed in Obsidian while it is open here, the save wins
  over those changes rather than merging or asking.
- **The editor is a textarea with a preview, not a WYSIWYG.** Body text is edited as Markdown and the
  preview beside it is a separate rendering, not a document you type into; there is no toolbar. The
  preview is redrawn on every keystroke, which is fine for a note and visibly slow for a very large
  one (thousands of lines, or a fence in a language the highlighter knows). It also does not scroll
  in step with the textarea: the two panes keep their own positions. Anything the textarea does not
  do — tabs, a stored cursor position, the spell-check language — is the browser's behaviour, not
  the app's.
- **The preview stacks below the textarea on a narrow window.** It sits beside the editor only at the
  `md` breakpoint and wider; below that, half a column of prose would be unreadable, so the panes
  become one above the other.
- **With the daemon down the app reads demo data, not your vault**, and Edit, Rename, Move and
  Delete are disabled because there is nothing to save to or remove: a demo note has no file behind
  it. `src/lib/demo.ts` is the fallback, so a stopped daemon shows demo notes rather than a blank
  screen.
- **Graph layout is remembered per session, not per vault.** Node positions and a view the user
  placed survive a tab switch while the app runs, in module scope rather than in storage, so a reload
  starts from a fresh layout. Only a coordinate is remembered, not why the layout looked that way: a
  note added between two visits is placed by the simulation among the seeded nodes, which can nudge
  its neighbours a little.
- **Search needs the daemon for body text.** The palette ranks titles, tags and previews from the
  loaded listing, which holds only an excerpt. A word that appears deep in a note body is found by
  `GET /notes/search`, so with the daemon stopped that match is simply absent — and the demo vault
  has no body index either. The footer says so rather than pretending the vault is fully searched.
- **Search finds notes, not lines.** A result opens the note; the matching passage is not highlighted
  and the body match is not scrolled to. Results are also capped at 12 (10 local, plus body-only
  matches), so a very broad query is a shortlist rather than a list.
- **Recent notes are the session's, not history.** The empty palette lists up to five notes opened
  while the app is running, and a reload clears the list. Nothing is persisted, so there is no
  "recently opened" on a cold start, and the order is opening order rather than last-edited time.
  Only an actual pick counts: the note the app selects for you at launch, or one that becomes active
  because a folder or tag filter narrowed the list, is not recorded - the history is what you opened,
  not what the shell happened to show. A note deleted while the app runs drops out of the list,
  which is deliberate: a dead row is worse than a shorter list.
- **Backlinks are link-only.** A note that shares a tag with the open one is deliberately not listed
  as a backlink - it is a neighbour in the graph, not something that points here - so "Linked from"
  can be empty on a tag-heavy vault. With the daemon down the list comes from the demo graph, so a demo
  note that links to another demo note shows its sources, while a real note offline simply shows none.
- **The pane width is not remembered.** The list column is resizable between 240 and 560px, but the
  width lives in the running app only: a reload starts at 320px, and nothing is written to storage.
  The sidebar's own width is fixed, so the folder list cannot be narrowed or widened, and the Graph
  tab has no panes to size.
- **The file operations are one note at a time.** Rename, move and delete act on the open note, so
  there is no selection, no multi-select and no way to move ten notes at once - bulk operations are on
  the open list in [TODO.md](TODO.md).
- **Keyboard movement covers the list, not the panes.** `j`/`k` walk the note list, but the viewer,
  the link pane and the tag chips are reached with `Tab`; there is no `j`/`k` inside a note body, and
  no shortcut for the folder list or the tabs.

## Vault and data

- **One vault, one machine.** `VAULT_PATH` points at a single directory. There is no multi-vault
  support, no sync, no backup and no export.
- **Notes are plain Markdown at rest.** That is the point of the product, but it also means no
  encryption: anything with access to the directory can read every note.
- **A message whose body starts with `# ` keeps no tags.** The command parser collapses a message to
  a single line, and the tag reader skips a line that looks like a Markdown heading, so
  `/goal # quarter review and #ship` files the note with `tags: []` even though `#ship` was written.
  The text is still filed, nothing is lost from the note, and `#ship` written anywhere other than at
  the very start of the body is picked up normally. Capturing a message with its line breaks intact
  would close it.
- **Same-title collisions get a timestamp.** `saveNote` never overwrites, so two notes with the same
  title on the same day land as `…-<slug>.md` and `…-<slug>-<millis>.md`, which is safe but ugly.
  A rename and a move refuse the collision instead (`409`), because someone is there to pick another
  name and a millisecond suffix in a note they named themselves is not what they asked for.
- **A trashed note lives only on this disk, and only until someone empties the trash.** `DELETE /note`
  moves the file to `.trash/<id>/<folder>/<name>`; `GET /trash` lists it and `DELETE /trash` removes
  every entry for good, with no grace period and no second copy anywhere - a local-first vault has no
  server-side history to fall back on, so emptying is one of the few operations in the app with no
  undo, which is why it takes two presses. Emptying also takes the links those notes carried with it:
  a `[[wikilink]]` to a note that is gone stays in the body as text and the graph simply drops the
  edge, rather than the link being rewritten or the note resurrected. A restore still needs the old
  name to be free: a note that took it in the meantime is a `409`, and the trashed copy stays put.
- **Editing tags or status re-serialises the block.** Only the frontmatter block is rewritten, and
  the body is byte-identical afterwards, but the block is parsed and written back out: a comment
  inside it, a hand-chosen key order, or YAML style someone preferred is not preserved. Only `tags`
  and `status` can be changed from the app; every other field is still the file's own business, and a
  block that does not parse is refused rather than repaired (`400`).
- **A rename follows the links, with three exceptions.** A link inside a code fence or inline code
  is left alone, because the graph does not read it as a link either and a rename has no business
  editing a code sample. A link written to a frontmatter alias keeps the author's wording: the alias
  survives, so it still resolves. And a note that links to its own old title keeps that text - the
  note's own body is retitled, not scanned for its own links. Every other link that pointed at the
  old title is rewritten in the same operation.
- **A move keeps the filename.** A note moved from Ideas to Goals is still
  `2026-10-20-learn-rust.md`, because the date belongs to the note; only a rename changes the name.
- **A rename rewrites the first heading.** It is the title the app shows, so leaving it behind would
  make the header and the list disagree; a note whose `# heading` was hand-written differently loses
  that wording. The frontmatter is not touched, and a note with no heading keeps its body untouched.
- **A folder rename only rewrites links that named the folder.** A link written by title, by slug
  or by bare filename still resolves after the move - the resolver finds the note wherever it lives
  - so only a link like `Movies/…md` is rewritten to the new path. That is the author's wording
  rather than a broken path, and rewriting every link that merely mentions the folder would be the
  app editing sentences that were already true.
- **A folder with files that are not notes is kept, not emptied.** Removing one moves the notes to
  Inbox and leaves any `cover.jpg` or `.obsidian/` where it is, the same rule the trash follows; the
  reply says the folder was kept, because a folder that still holds files cannot be removed without
  deleting something someone made outside Lumos.
- **Frontmatter validation is a report, not a repair.** The four fields the app reads are checked when
  a note is loaded, and the reasons travel to the viewer and the API, but the file on disk is never
  rewritten: a bad `created` keeps its written value, so the note sorts by it as a string until you
  fix it. A field outside those four is not checked at all, on purpose. Nothing validates the vault
  in CI either - it is git-ignored, so the gate can only run the rules over fixtures.

## Delivery and process

- **Nothing reviews a change before it reaches `main`.** The project works on a single branch, so a
  commit reaches the remote as soon as `pre-push` (`pnpm validate`) passes; CI runs the same gate on
  the push, which reports a breakage after it has landed rather than blocking it. One topic per
  commit keeps `git revert` a clean way back. We gave up the pre-merge review step in exchange for
  not maintaining a second branch and a merge per change.
- **CI is Linux-only.** Windows and macOS are not exercised by the workflow, so CRLF handling, path
  separators and the Tauri build are local observations.
- **The E2E smoke suite is a smoke suite, not a full pass.** Its 5 tests cover one happy path through
  the built bundle - load, open a note, follow a backlink, filter by a tag, search from the palette.
  They run on Chromium only (no Firefox or WebKit), against a 3-note fixture vault, and they drive
  the browser-served app rather than the packaged Tauri window, so the Tauri shell is still a manual
  check. Editing, creating, renaming and deleting are covered by the jsdom suites, not here.
- **The E2E suite does not run on `pre-push`.** It is a separate CI job, so the gate a contributor
  feels locally (`pnpm validate`) is not the whole gate; a red e2e can still be found after a push.
- **Nothing is packaged or versioned.** There is no installer, no release, no tag and no published
  artifact; `CHANGELOG.md` tracks changes under `Unreleased`.

## Performance

Mostly design observations. The search figures below are measured; the rest have no vault large
enough behind them yet.

- **Only search is indexed.** `GET /notes/search` keeps the note bodies it has read in memory and
  re-reads one only when its mtime or size moved, so a repeated query no longer touches the disk for
  a body. The listing is still read fresh on every query - that is what makes a note written by the
  phone appear at once - so a query stays proportional to the vault's *file count and parse*, which
  was 184-185 ms of the 350-446 ms it used to take over 600 notes (1.9 MB, Windows). `/graph` reads
  every note body on each request and a rename reads the whole vault, because it has to know who
  links to the note before it can rewrite them.
- **The index costs memory.** It holds the lowercased text of every note it has searched, so it is
  roughly the size of the vault's Markdown, and it lives in the daemon's process - a restart starts
  it empty, and a second client shares the same index rather than getting its own.
- **The link cache is memory only.** A URL costs one fetch and a scrape of up to 1 MiB per session,
  reused for every later visit to it; the map is unbounded, which is fine for a session's worth of
  links and is not a store.
- **The highlighter is the largest thing in the main bundle.** `rehype-highlight` registers 37
  grammars, which took the main desktop chunk from 435 kB to 602 kB (135 kB to 189 kB gzipped,
  measured with `vite build` before and after). Trimming it to a handful of languages would need
  `highlight.js` as a second direct dependency and a list to maintain, so the whole common set stays
  and the cost is written down instead. The graph renderer is still the heavier *chunk* of the two,
  but it is lazy-loaded with its tab, so the graph is not on the notes path.
- **Only a fence that names its language is highlighted.** An untagged block stays plain (guessing
  the language colours prose as code) and a language outside the 37 common ones is left as text, so
  a block tagged `zig` or `haskell` reads uncoloured rather than wrong. There are no line numbers,
  no copy button and no way to select a theme: the colours are the app's own `--color-code-*` tokens.
