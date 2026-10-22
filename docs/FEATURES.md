# Lumos - Feature Status

Status values: **done** · **in-progress** · **planned** · **idea**

Ordered like the checklist in [`TODO.md`](TODO.md): what is still planned or only an idea first,
then what is in progress, then what is done.

## Planned and ideas

| Feature | Status | Notes |
|---|---|---|
| `/plan` with Ollama | planned | Local AI daily planning |
| Markdown preview beside the editor | planned | Today the rendered form is the view after a save |
| Creating a note from the desktop | planned | Editing an existing note works; an empty vault cannot be filled from the app |
| Link enrichment | idea | Summaries and key points from links |

## In progress

Nothing in progress.

## Done

| Feature | Notes |
|---|---|
| Config file | `lumos.config.json` for the vault path, port, allowlist and the WhatsApp switch, with the environment overriding it. A missing file means the defaults; a bad one stops the daemon with one sentence naming the setting |
| WhatsApp capture | Baileys multi-device, allowlist, auto-reconnect |
| Command parsing | `/idea`, `/interview`, `/goal`, `/read`, `/plan`, `/find`, `/help` |
| Vault writer | Markdown + YAML frontmatter, slugified filenames |
| HTTP API | `POST /message`, `GET /health`, plus the six read-API routes in the row below |
| Link expansion | `GET /link` reads title/description/og:image and the readable text of a page, for `/read` and `/interview` links |
| In-app playback | A YouTube or Vimeo link plays in the note viewer (no-cookie embed), an image link renders as the image; neither needs the daemon |
| Social embeds | An Instagram post, reel or IGTV link and a Facebook video, reel or post render in place through the host's own embed, classified from the URL alone. The caption, site and lead image come from the daemon's `/link` when it is running, so the embed plays with the daemon stopped and only loses its caption |
| Embed frames | `LinkMedia.frame` picks the box: 16:9 for a video, portrait for an Instagram permalink, a taller card for a Facebook post that keeps its caption and reaction counts |
| Page reader | The scraped text of a link, capped at 6,000 characters, rendered as text with a loading, error and retry state. The site's chrome is stripped first: chrome elements, `<pre>` code samples, a repeated line, a bare bracketed label and `data-` payloads all stay out. An Instagram or Facebook permalink has no readable body (a JavaScript shell), so those show the embed and its metadata instead of an empty reader |
| Link safety | `GET /link` refuses non-http(s) URLs, credentials in the URL, and anything local — including a redirect into a private address — with time, redirect and size caps |
| `/find` search | Searches title, tags and body; replies with up to five matches and counts the rest |
| Tag extraction | `#hashtags` in a captured message become the note's frontmatter tags (lower-cased, de-duplicated), read by `extractTags()` - the same function the graph builds tag nodes with - so the tags in the file and the tag nodes in the graph cannot disagree |
| Shared packages | `@lumos/shared` types + `@lumos/vault-utils` (parse/list/search/write) |
| Vault listing/search | `listNotes`, `getNotesByFolder`, `searchNotes`, `readNote` |
| Frontmatter validation | `validateFrontmatter()` checks `created`, `tags`, `source` and `url` and reports one reason per broken field; a note with a broken block is still listed and readable, and the viewer shows the reasons above the body (`validateFrontmatter()` in `@lumos/vault-utils`, unit-tested) |
| Vault graph | `extractLinks`/`extractTags`/`buildGraphFromNotes`/`neighborhood` in `@lumos/vault-utils` (`./graph` subpath, browser-safe) |
| Link parsing | `parseLinkMedia`/`extractPreview`/`firstExternalLink` in `@lumos/vault-utils` (`./link` subpath, browser-safe) |
| Daemon read API | `GET /notes`, `/notes/search`, `/folders`, `/note`, `/graph` + CORS |
| Dark UI theme | Tailwind v4 tokens, near-black background |
| Resizable panes | A `separator` between list and viewer: drag, double-click to reset, `←`/`→`/`Home` from the keyboard, 240-560px and kept while the Graph tab is open (`src/lib/pane-size.ts`) |
| Desktop vault browser | Folder sidebar + note list + viewer + status bar, with tag filtering |
| Tag filtering | The tags in the current folder and query become chips with counts; a chip, or a tag on a note card, narrows the list. A tag node in the graph offers **Show notes** with the same filter (`src/lib/filter.ts`, unit-tested) |
| Note viewer | Markdown via `react-markdown` + `remark-gfm` (tables, task lists, fenced code) |
| Note editing | **Edit** turns the body into a textarea; Save (`Cmd/Ctrl+S`) writes it back through `PUT /note`, Cancel (`Esc`) drops it, and a failed save keeps the draft and shows the daemon's sentence. Only the body is written — the frontmatter block survives character for character — and the listing, folder counts and graph are re-read afterwards, with a status-bar notice if that refresh fails (`src/components/NoteEditor.tsx`) |
| Safe writes | The path is checked against the vault root before anything is read, and the note is written to a temporary name then renamed over itself, so an interrupted save cannot truncate it (`replaceNoteBody()`, `updateNote()` in `@lumos/vault-utils`) |
| Markdown rendering | Headings, lists, tables, blockquotes, task lists, links; styled with the dark tokens |
| Code syntax highlighting | `rehype-highlight` over 37 common languages, only for a fence that names one; the token colours are `--color-code-*` tokens in `src/index.css`, not a pasted theme |
| Full-text search UI | `Cmd/Ctrl+K` palette: fuse.js ranking over titles, tags and previews, plus the daemon's `/notes/search` for words that only appear in a note body (those rows are marked "in the body"). Arrows, Enter and Esc wired; the shortcut is also a button in the status bar |
| Link pane cache | A scraped page is kept for the session by URL (`src/lib/link-cache.ts`): a remount, a tab switch and StrictMode's double mount reuse one read, and a second caller joins the request in flight. Failures are not cached, so Retry is real |
| Recent notes | An empty `Cmd/Ctrl+K` palette lists the notes opened this session, newest first and up to five; arrow keys and `Enter` work there, and a note that left the vault is skipped (`src/lib/recent.ts`) |
| Backlinks | The note viewer lists the notes that link to the open one, from the same graph the Graph tab draws, and each is a button that opens it. Tag references are not backlinks: sharing a tag makes a note a neighbour, not a source. Works offline against the demo graph (`backlinks()` in `@lumos/vault-utils/graph`) |
| List keyboard | `j`/`k` move the note-list selection, clamped at both ends and disabled while a field has focus or the palette is open (`src/lib/list-nav.ts`) |
| Graph view | Canvas force graph: glow nodes sized by backlinks, curved synapse edges, one hue per folder, tag and unlinked filters, local depth around the open note, demo graph when the daemon is offline. Node positions and a view the user placed survive a tab switch, and a resize refits a view the app fitted itself |
| Lint + format gate | oxlint + prettier, run on staged files by lint-staged |
| Commit message lint | commitlint enforces `<type>(<scope>): <description>` |
| Pre-push validation | `pnpm validate` — lint + format:check + typecheck + test + build |
| Test runner | vitest 5; `pnpm test` runs every workspace that has a suite |
| Desktop tests | 116 tests, run by `pnpm test`: 69 over pure logic (the note filter, the demo vault, the search ranking/merge, the recent-notes order, the link cache, list movement, the pane widths, the graph layout memory), 8 for the viewer through SSR renders (code highlighting, the frontmatter warning and the Edit affordance), and 39 component tests in jsdom + Testing Library for the sidebar, the note list, the search palette, the link pane and the note editor |
| Parser & vault tests | 261 tests: 155 for `@lumos/vault-utils` (frontmatter rules, link/tag extraction, graph assembly, neighbourhoods, link parsing and page metadata, the Instagram/Facebook URL shapes, tags written at capture, and a body saved back with its frontmatter untouched) and 106 for the daemon (including `/find`, the link fetcher's refusals, `PUT /note` and every HTTP route driven through `app.inject()`) |
| Read API route tests | `createApp()` in `apps/daemon/src/app.ts` builds the app over a vault directory; `app.test.ts` covers every route plus CORS through `app.inject()`, with the link fetcher injected |
| Branch workflow | Short-lived `<type>/<description>` branches; `pre-commit` blocks commits on `main` |
| Agent working agreement | `RULES.md`, `AGENTS.md`, `CLAUDE.md` at the repo root |
| CI validation | GitHub Actions runs `pnpm validate` on every PR into `main` and every push to `main` |
| Branch protection | `pnpm validate` is required on `main` together with a pull request and an up-to-date branch; force pushes and deletions are blocked |
