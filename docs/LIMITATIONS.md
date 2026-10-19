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
  reproduced: the extraction flattens structure into lines. Code samples and repeated navigation text
  do come through from some sites (MDN is the example the tests use).
- **Text is capped at 6,000 characters.** Past that the pane says so and offers the real page. There
  is no "load the rest" path, and no way to raise the cap from the UI.
- **JavaScript-rendered pages come back nearly empty.** Only the initial HTML is fetched — no browser,
  no script execution — so a single-page app reads as a shell. Paywalled, login-only and interactive
  pages are in the same place.
- **Non-HTML content is refused** (PDF, JSON, video, archives), named by its content type. Reading a
  PDF or a local HTML file the same way is in [TODO.md](TODO.md).
- **Nothing is cached.** Reopening a note refetches the page; in development React StrictMode
  invokes the effect twice, so it fetches twice. A page that changes between reads shows both versions.
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
  app is still manual, like the rest of the Tauri shell. Embedding is the platform's to change — a
  plugin URL could stop working without notice, and no test can fail to warn you.

## Capture (WhatsApp)

- **Baileys is an unofficial WhatsApp Web client.** An account can be banned for using it, which is
  why the README suggests a spare number. This is a risk of the approach, not a bug to fix.
- **The live WhatsApp session is not tested.** The parser, the filing path, `/find` and the read API
  have tests; the Baileys connection has none — it needs a real linked device and would be flaky in
  CI. The manual check for it is a QR link followed by a real message.
- **Messages during a disconnect are lost.** Reconnection backs off and retries the socket, but there
  is no queue and no replay, so a message sent while the daemon is down is simply not captured.
- **The allowlist is an exact number match.** There is no per-chat or per-command permission, and an
  empty `ALLOWED_NUMBERS` blocks everything (a deliberate default).
- **A URL in a plain message is stored, not fetched.** Link expansion happens when the desktop opens
  the note; the WhatsApp reply never includes the page title.

## Desktop

- **The Tauri shell is untested by CI.** Only the web UI is exercised (in a browser). The Rust side,
  the window configuration and the packaged bundle are manual checks: `pnpm --filter desktop tauri dev`.
- **No component tests.** There is no jsdom or Testing Library setup, so the sidebar, list, viewer,
  graph and link pane have no automated coverage — the states were checked by hand.
- **Read-only.** Notes cannot be created, edited, moved or deleted from the app; the desktop reads
  through the daemon HTTP API and writes nothing. With the daemon down it falls back to
  `src/lib/demo.ts`, so it shows demo data rather than your vault.
- **Graph rough edges.** The canvas transform is kept across a pane resize, so the graph can sit
  off-centre until *Fit* or a filter change; node positions are not kept across tab switches; tag
  nodes cannot be clicked as a filter yet.
- **No keyboard navigation for the link pane.** The reader and the player are inside the note scroll
  area, and only the note list has `j`/`k`-style movement planned.

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
- **Frontmatter is not schema-validated**, in CI or at write time. A malformed file is skipped by the
  listings rather than reported.

## Delivery and process

- **An administrator can still push to `main` directly.** Branch protection requires a pull request,
  the `pnpm validate` check and an up-to-date branch, but `enforce_admins` is off, so a break-glass
  push stays possible on a personal repository. The gate is a guardrail, not a lock.
- **CI is Linux-only.** Windows and macOS are not exercised by the workflow, so CRLF handling, path
  separators and the Tauri build are local observations.
- **Nothing is packaged or versioned.** There is no installer, no release, no tag and no published
  artifact; `CHANGELOG.md` tracks changes under `Unreleased`.

## Performance

These are design observations, not measurements — no vault large enough to show them has been built.

- **Nothing is indexed.** `/graph` reads every note body on each request, and `searchNotes` reads
  whole files whenever the excerpt does not match, so both grow with the size of the vault.
- **The link pane has no cache**, so each visit to a note costs a fetch and a scrape of up to 1 MiB.
- **The graph renderer is the heaviest dependency** in the app; it is loaded lazily with its tab, so
  the notes path does not pay for it.
