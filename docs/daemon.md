# Daemon

The daemon is the capture half of Lumos: it connects to WhatsApp, parses messages, and writes
Markdown notes to the vault. It lives in [`apps/daemon`](../apps/daemon).

## Responsibilities

- Hold a WhatsApp multi-device session (Baileys).
- Accept messages only from allowed senders.
- Parse command text into a typed result.
- Write structured Markdown notes to the vault.
- Reply to the sender with a short confirmation.
- Optionally expose the same logic over HTTP for testing/integration.

## Modules

| File | Responsibility |
|---|---|
| `src/commands.ts` | `parseMessage()` - turns raw text into a typed `Parsed` result.
| `src/config.ts` | `loadConfig()` - reads the JSON config file, lets the environment override it, and refuses a setting it cannot use with a sentence naming it.
| `src/handler.ts` | `handleMessage()` - routes a parsed command to a reply string. The vault directory is an argument, so the caller decides where a note lands.
| `src/app.ts` | `createApp()` - builds the Fastify app (CORS + every route) over a vault directory, so a test can drive it without binding a port.
| `src/server.ts` | Entry point: builds the app, listens on loopback, boots the WhatsApp connection.| `src/fetch-link.ts` | Fetches one link for the desktop, with the guards `GET /link` relies on.
| `src/plan.ts` | `buildPlan()` - the vault's newest notes become one prompt for the local Ollama model; every failure arrives as a sentence a person can act on, never as the socket's own words. | `src/whatsapp.ts` | Baileys connection, QR auth, allowlist, message loop. |
| `src/qr.ts` | The pairing code the socket emits, held between the socket and `GET /qrcode`, plus its half-block rendering for the page. |

## Commands

| Command | Destinations |
|---|---|
| `/idea <text>` | `vault/Ideas/` |
| `/interview <text or link>` | `vault/Interviews/` |
| `/goal <text>` | `vault/Goals/` |
| `/read <link>` | `vault/Reading/` |
| `/plan today\|tomorrow` | Replies with a plan from the vault's 20 newest notes, through the local Ollama model. Ollama stopped, a timeout or a model that is not pulled each answer with the sentence that says so |
| `/find <query>` | Search the vault; replies with the title and folder of each match |
| `/<folder> <text or link>` | Any folder the vault has, by its own name: a `Movies` folder answers to `/movies`, and `To Read` to `/to-read`. There is no second list of commands to keep in step, so a folder made a moment ago works on the next message |
| `/newfolder <name>` (also `/folder`) | Makes the folder and answers the command that now files into it. A name already in use is refused, and so is one that could not be a directory inside the vault |
| `/renamefolder <from>\|<to>` | Renames a folder. Every note inside keeps its filename and its date, and the links that named the old folder are rewritten in the notes that carried them. The separator is `\|` because that is the one character a folder name can never carry, so the two halves cannot be read the wrong way |
| `/delfolder <name>` (also `/removefolder`) | Removes a folder and moves its notes to Inbox. A folder is only a place to file things, so removing one never takes a note with it; the reply says how many moved |
| `/` on its own | The menu: one line per folder plus the non-filing commands, read from the folders on disk |
| `/help` | prints the command list |
| plain text | `vault/Inbox/` |

## HTTP API

The daemon listens on `127.0.0.1:3001`.

### `GET /qrcode`
The WhatsApp pairing page: HTML, never cached, refreshing itself every ten seconds because the code
rotates. It draws the code the socket is waiting for, so a phone can be paired from the app instead
of from the terminal the daemon was started in. With nothing to pair - already linked, or capture
off - it is still a `200`, with the sentence that says which. The code is a session secret: it is
answered to the loopback caller that asked and never logged.

### `POST /message`
```json
{ "text": "/idea build a habit tracker" }
```
Response: `{ "reply": "Filed in Ideas: build a habit tracker" }`. Missing `text` returns HTTP 400.

### `GET /health`
Response: `{ "ok": true }`.

### `GET /notes`
Every note in the vault, newest first: `{ "notes": VaultEntry[] }`. An entry whose frontmatter has a
problem carries `problems: string[]` with the reasons; a clean entry has no such field, so the usual
response is unchanged. A note with a broken block is listed rather than dropped.

### `POST /notes`
```json
{ "folder": "Ideas", "text": "Book the flights #travel\n\nTwo weeks in October." }
```
Creates a note and answers it as the vault now reads it: `{ "note": { title, folder, file,
frontmatter, content, problems } }`.

The writer is the one WhatsApp capture uses, minus the command parsing — the first line becomes the
title, `#hashtags` become frontmatter tags, and the filename is `YYYY-MM-DD-slug.md`, so a note
written here and a note captured on a phone are the same shape of file. The one difference is
`source: desktop`: the field is shown to the person reading the note, and a note that claims the
wrong origin is worse than one that says nothing.

The allowlist does not apply: that belongs to WhatsApp, not to the machine you are sitting at.
A missing folder, a missing `text` or text that is only spaces is `400 folder and text are
required`; a folder outside the known set is `400 unknown folder`, and nothing is written anywhere.
A second note with the same text gets its own file — the writer never overwrites.

### `GET /notes/search?q=<query>`
Case-insensitive search across titles, content, and tags: `{ "notes": VaultEntry[] }`.

The app builds one index at startup (`createNoteSearch`) and answers every query from it. The
listing is read fresh on each query, so a note the WhatsApp bridge or an editor wrote is found
immediately; the note bodies are kept in memory and re-read only when a file's mtime or size
moved. That is the whole gain: the palette asks on every pause in typing, and the second query
for the same vault no longer reads a megabyte of Markdown again. A body for a note that has left
the vault is dropped on the next query, so a delete does not keep its text in memory.

Measured on 600 notes (1.9 MB) on Windows with the daemon's routes: `searchNotes` (uncached)
350-446 ms per query, warm `createNoteSearch` 184-185 ms. The remainder is the always-fresh
listing and its YAML parse, not search.

### `GET /folders`
Note counts per folder: `{ "folders": [{ "folder": "Ideas", "count": 3 }] }`. The list is the
vault's own directories, so a folder made a moment ago is in it and an empty one still appears.

### `POST /folders`
```json
{ "name": "Movies" }
```
Response: `{ "folder": "Movies" }`. A name already in use is a `409` and one that could not be a
directory inside the vault - a separator, `..`, a leading dot - is a `400`; both carry a sentence.
Every folder a route accepts is checked against this same list, so `POST /notes` into a folder made
here succeeds without a restart.

### `PATCH /folder`
```json
{ "folder": "Movies", "to": "Film" }
```
Renames a folder. A folder is a directory, so this is one `rename` on disk: every note inside keeps
its filename, its date and its bytes, and only the path to them changes.

The links that *named the folder* are rewritten in the notes that carried them, and the files
touched come back as `updated`. Only a written path is corrected: a link by title, by slug or by
bare filename still resolves after the rename (the resolver finds a note wherever it lives), so it
is the author's wording rather than a stale path and is left exactly as written.

Response: `{ "folder": "Film", "moved": 2, "updated": ["Ideas/2026-10-20-see-it.md"] }`.

`400` for a missing `to`, a name the vault cannot make, or a rename to the name it already has;
`404` for a folder that is not there; `409` for a name another folder already holds - a rename
never merges two folders, because the person renaming is right there and can choose another name.

### `DELETE /folder?folder=<Folder>`

Removes a folder by moving its notes to Inbox, and answers what happened:
`{ "folder": "Movies", "to": "Inbox", "moved": 2, "updated": [], "leftover": false }`.

Moving rather than deleting is the whole point of the route: a folder is a place to file things, so
removing one must never take a note with it. Every name is checked against the destination *before*
anything moves, because a refusal halfway through would leave the folder half emptied, which is
worse than not having started. Files that are not notes are left exactly where they are - the same
rule the trash follows - so a stray file keeps the directory and `leftover` says so rather than the
caller having to guess why the folder is still there.

`400` for a missing `folder`, a destination the vault cannot make, or removing Inbox itself (that is
where the notes would go); `404` for a folder that is not there; `409` when the destination already
holds one of the names, with nothing moved.

### `GET /note?folder=<Folder>&name=<file.md>`
A single note (`frontmatter` + `content`), plus `problems`: an array of frontmatter complaints, empty
when the note is well formed (see [vault.md](vault.md)). A broken block is reported, never a `500`.
Returns `400` for an unknown folder or an unsafe filename, and `404` when the note is missing.

### `PUT /note`
```json
{ "folder": "Ideas", "name": "2026-10-20-learn-rust.md", "content": "# Learn Rust\n\nship a CLI" }
```
Saves a new body into an existing note and answers the note as it now reads:
`{ "note": { title, folder, frontmatter, content, problems } }`.

Only the body is written. The frontmatter block is left character for character as the file has it,
so an invalid block, a comment, a key another tool owns and the block's ordering all survive an edit
— the reader reports a broken block, and the editor does not quietly repair it. `content` is the
body only: a title still comes from the first `# heading` in it, and clearing the body leaves the
frontmatter and a note whose title falls back to its filename.

An empty `content` is a real request (the text was deleted) and is told apart from a missing one,
which is a `400 content is required`. The guards are the same as `GET /note` — `400` for an unknown
folder or an unsafe filename — and a note that does not exist is a `404`, never a create. The write
goes to a temporary file in the same folder and is renamed over the note, so a failure part-way
leaves the old note intact instead of truncated.

### `PATCH /note`
```json
{ "folder": "Goals", "name": "2026-10-20-learn-rust.md", "title": "Ship a CLI in Rust" }
```
Renames a note to a new title. The title is the note's, not the file's: the file becomes
`<date>-<slug>.md`, keeping the `YYYY-MM-DD-` prefix it already had (a name that had none gets
none), and the body's first `# heading` is rewritten to the same title, so the listing, the viewer
and the file name agree afterwards. A note with no heading keeps its body and only its filename
changes, because a note's title falls back to the filename. The frontmatter block is left as it was
written.

A link resolves by title, so the rename also rewrites the links in other notes that pointed at the
old one, and keeps the shape each was written in (`[[title]]` becomes the new title, `[[name.md]]`
the new filename; a `#heading`, a `|alias` and an `!` embed marker survive). Only a target the rename
actually strands is edited: a link that still resolves afterwards - one written to an alias - and
anything inside a code fence or inline code is left as written.

Answers the note as it now reads, plus the files whose links followed it:
`{ "note": { title, folder, frontmatter, content, problems }, "updated": ["Goals/2026-10-20-learn-rust-properly.md"] }`.
`updated` is empty when nothing else linked here.

`400` for a missing title, an unknown folder or an unsafe name; `404` for a note that is not there;
`409 a note with that name already exists` when another note in the folder holds the filename, because
a rename never replaces one note with another. A title that slugs to the name the file already has
changes the heading and nothing else, and a rename to the title the note already has touches no file
at all.

### `PATCH /note/meta`
```json
{ "folder": "Ideas", "name": "2026-10-20-learn-rust.md", "tags": ["rust", "cli"] }
```
Changes a note's `tags` and/or `status` in place and answers it as it now reads:
`{ "note": { title, folder, frontmatter, content, problems } }`. Only the fields that are sent
change, so removing a tag never touches the status, and the body is byte-identical afterwards.

Tags are cleaned the way the graph reads one (no `#`, lower-case, trimmed, de-duplicated) because a
tag in the frontmatter and a tag node on the canvas have to be the same thing. The block is parsed as
the file has it, so a key another tool wrote survives; it is re-serialised, so a comment inside the
block is not kept.

`400` for a missing folder or name, an unknown folder, an unsafe name, a `tags` that is not a list of
strings, a `status` that is not a string, or a request carrying neither field; `404` for a note that
is not there; `400 this note's frontmatter is not valid YAML` when the block cannot be read, because
rewriting it would throw away whatever the person wrote.

### `POST /note/move`
```json
{ "folder": "Ideas", "name": "2026-10-20-learn-rust.md", "toFolder": "Goals" }
```
Moves a note into another folder under the name it already has, and answers it as it now reads. The
filename is kept on purpose: the date in it belongs to the note, and a move is about where a note
belongs rather than what it is called. Moving a note to the folder it is already in changes nothing
and answers the note. `400` for a missing field, an unknown folder on either side or an unsafe name;
`404` for a note that is not there; `409` when the destination folder already holds that filename.

### `DELETE /note?folder=<Folder>&name=<file.md>`
Moves the note out of its folder and into the vault's trash: `{ "trash": { "id", "folder", "name", "deleted" } }`.
Nothing is removed from the disk - the file lands in `.trash/<id>/<folder>/<name>`, which is what
`POST /note/restore` reads. `400` for a missing parameter, an unknown folder or an unsafe name, and
`404` for a note that is not there - a delete never reports success for a file it did not move, and
a refused delete creates no entry.

### `POST /note/restore`
```json
{ "id": "2026-10-23T15-42-07-123Z" }
```
Puts a trashed note back where it came from and answers it as the vault now reads it:
`{ "note": { title, folder, frontmatter, content, problems } }`. Only the entry is named, never the
destination: the trash entry holds the folder and filename the note was deleted from, so an undo
cannot be aimed at another note. The entry is removed once the file is home, which is why an id
works once.

`400` for a missing or malformed id, `404` when that entry is no longer in the trash, and
`409 a note with that name already exists` when a note has taken the name again while the deleted
one was away - replacing it would be a second, silent delete.

### `GET /trash`
Everything in the trash right now, newest delete first:
`{ "trash": [ { "id", "folder", "name", "deleted" } ] }`. It is a listing of trash entries, not of
notes: nothing here has a title or a body, because the panel only needs the name to restore it and
the folder and date to say which note it was. An empty trash answers `{ "trash": [] }`, which is a
list of nothing rather than an error - the app says so itself.

### `DELETE /trash`
Removes every entry in the trash, and answers how many went: `{ "removed": 3 }`. There is no
parameter for a single entry - restoring is how one note leaves, and this is the one command in the
daemon with no undo, so it deliberately has no narrower form. `200` with `removed: 0` for an empty
trash rather than a `404`, because asking to empty something that is already empty is not a mistake.
Entries the folder listing cannot read are skipped rather than failing the whole request: a trash
someone half-cleaned by hand should not be able to refuse the rest.

### `GET /link?url=<url>`
One link, scraped for the desktop: `{ "link": LinkCard }` — how the app shows it inline (`kind`,
`embedUrl`, `poster`, `frame`) plus the page's `title`, `site`, `description`, `image` and readable
`text`. `kind` is one of `youtube`, `vimeo`, `instagram`, `facebook`, `image` or `page`.

The `text` is the page's prose, not its markup: `<script>`, `<style>`, `<nav>`, `<header>`,
`<footer>`, `<aside>`, `<form>`, `<dialog>`, `<button>`, `<select>` and whole `<pre>` code samples
are dropped, along with a line that merely repeats the one before it and a line that is only a
bracketed label such as `[ edit ]`. `data-` attributes are removed before anything else, because a
machine payload (Wikipedia's `data-mw`) can contain a `>` that would otherwise end the tag early and
leak into the text. [LIMITATIONS.md](LIMITATIONS.md) names what this gives up.

A YouTube, Vimeo or image link is answered from the URL alone, with no request at all, so it plays
with the daemon stopped. Everything else is fetched, including an Instagram or Facebook permalink:
those two render nothing readable (their body is a JavaScript shell), but their page still publishes
the caption, site and lead image the desktop shows as a card above the embed.

The URL is untrusted like a vault path, so only `http` and `https` are accepted, and anything
local is refused: `localhost`, `*.local`, `*.internal`, loopback, private, link-local and
reserved addresses — including a public URL that *redirects* into them, since every hop is
checked. A URL carrying credentials is refused too. The fetch is bounded: 8 s, 3 redirects and
1 MiB of body - 10 MiB when the response is a PDF, which is read in whole far more often than a
page is. HTML, XHTML and plain text are read as pages; `application/pdf` is read as a document and
answered as the same card, with its file name as the title; a file served as
`application/octet-stream` (or `binary/octet-stream`) is judged by its first bytes - a PDF by its
`%PDF-` magic, a page by its doctype - and anything else, video or JSON or an archive, is refused
before its body is downloaded, named by its content type. A refusal is a `400` with a message, an
unreachable page is a `502`; neither is a stack trace, and the URL itself is
never logged (it can carry private detail).

A name is resolved and every answer is checked, which closes the ordinary rebinding case; a name
that resolves publicly and then moves is a known, accepted limit of a reader on a personal machine.
[LIMITATIONS.md](LIMITATIONS.md) lists what the reader cannot do at all - no JavaScript, no local
addresses even by choice - and why each of those is deliberate.

### `GET /graph`
The vault's link graph: `{ "graph": { "nodes": GraphNode[], "edges": GraphEdge[], "unresolved":
UnresolvedLink[] } }`. Notes and tags are nodes; internal links (`[[wikilinks]]` and relative `.md`
links) and tag references are edges. A note's `inDegree` counts the notes pointing at it, and
`orphan` marks a note with no links and no tags. Links whose target does not exist are reported in
`unresolved` instead of being invented as nodes. Built by `buildVaultGraph()` from
`@lumos/vault-utils`, which reads every note body.

CORS is enabled for local development origins (`localhost`, `127.0.0.1`, `tauri://`) since the
server binds to `127.0.0.1` only, and for the methods the routes actually serve: `GET`, `POST`,
`PUT`, `PATCH` and `DELETE`. The plugin's default is `GET,HEAD,POST`, which let `curl` save a note
while the app's own `PUT` was stopped in the browser's preflight — so the list is written out rather
than inherited, and every method a route adds has to be added here too.

### When a route fails

Each route answers its own refusal with a sentence that names the cause - `400 text is required`,
`400 unknown folder`, `400 invalid name`, `404 note not found`, `409 a note with that name already
exists`, and the link fetcher's reasons - and a
`4xx` Fastify raises itself (a malformed JSON body, say) keeps its own message, which is about the
request rather than about the machine.

Anything else disappears into one handler: `500 { "error": "The daemon could not finish that
request." }`. The error's own message is deliberately absent, because a Node error is written as the
absolute path it failed on (`ENOENT ... Ideas/x.md`), so sending it would tell the caller where the
vault is. The log keeps what is useful and harmless - the error's `name` and `code`, tagged with the
request id - and never the path.

## Configuration

Settings come from a JSON file, and the environment overrides it. Precedence is
**environment > file > default**, so a one-off `VAULT_PATH=... pnpm dev` still works when a file
exists, and the file stays the thing a person edits.

The file is `lumos.config.json` in the daemon's working directory, or wherever `LUMOS_CONFIG`
points. It is git-ignored, because a vault path and phone numbers belong to one machine:

```json
{
  "vaultPath": "../../vault",
  "port": 3001,
  "allowedNumbers": ["15550100000"],
  "whatsapp": true,
  "ollamaUrl": "http://127.0.0.1:11434",
  "ollamaModel": "llama3.2:3b"
}
```

A missing file is not an error - the daemon has always started without one. A file that is
unreadable, not valid JSON, or names a setting that cannot be used stops the daemon with one
sentence on stderr and exit code 1, rather than starting on a guess. An unknown key is refused
rather than ignored, so a typo cannot silently do nothing. A relative `vaultPath` resolves against
the file that named it, not the working directory, so the same file means the same vault however
the daemon was launched.

| Variable | Default | Description |
|---|---|---|
| `LUMOS_CONFIG` | `lumos.config.json` | Where to read the settings from, relative to the working directory or absolute. |
| `ALLOWED_NUMBERS` | `""` | Comma-separated sender numbers (country code + number, no `+`). Empty blocks all. |
| `VAULT_PATH` | `../../vault` | Vault directory, relative to the daemon's working directory. |
| `PORT` | `3001` | Port to listen on, 1-65535. The host is always `127.0.0.1`. |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Where the local Ollama listens. `/plan` names this address in its reply when nothing answers there. |
| `OLLAMA_MODEL` | `llama3.2:3b` | The model `/plan` asks, named as `ollama pull` would name it. |
| `LUMOS_DISABLE_WHATSAPP` | unset | Set to `1` to run the HTTP API on its own, with no WhatsApp connection (what the route tests use). |

Numbers are normalised however they were written: `+1 (555) 010-0000`, `1 555 010 0000` and
`15550100000` are the same sender, and a repeat is not counted twice. `PORT=0` is refused rather
than listened on: a random port is one the desktop cannot find.

## WhatsApp authentication

On first run a QR code is printed to the terminal and served at `GET /qrcode`, which is the page
the desktop's **Pair** button opens. Scan it from the Lumos number's **Settings > Linked Devices >
Link a Device**. The session is stored in `apps/daemon/auth_info/`, which is git-ignored and must
never be shared. Delete it to force a fresh pairing.

## Shared packages

The daemon uses [`@lumos/shared`](../packages/shared) for its types and
[`@lumos/vault-utils`](../packages/vault-utils) for vault operations (parse, read, list, search,
write). Keeping this logic in packages lets the desktop app reuse it.

## Tests

`pnpm --filter daemon test` runs the daemon suite (vitest):

- `src/commands.test.ts` - `parseMessage` over every command and over malformed input: blank
  messages, a bare `/`, unknown commands, `https` links inside plain text, `/plan` falling back
  to `today` for anything it does not recognise, and `/renamefolder` split on its `|` separator -
  including a name carrying spaces, a missing half, and a body with a second `|` in it.
- `src/handler.test.ts` - `handleMessage` from the message to the file on disk: the reply strings, the
  generated filename, and the frontmatter that was written. It passes a temporary directory in as the
  vault, so your own vault is never touched. Renaming and removing a folder each get their own
  throwaway vault per test, because those operations move whole directories around and a shared one
  would make every case depend on what the last left behind.
- `src/app.test.ts` - every route through `app.inject()`: the note listings and their empty case, search
  and its blank query, `POST /notes` creating a note with the right source and refusing every bad
  payload, the folder counts, `/note`'s guards (a missing parameter, an unknown folder, and
  each traversal shape tried against a decoy file left outside the folders), `PUT /note` saving a body
  with the frontmatter untouched and refusing every one of those shapes, `PATCH /note` renaming a note
  and answering its new name, `PATCH /folder` renaming a folder with the notes that came with it and
  the links it rewrote, `DELETE /folder` moving its notes to Inbox and refusing Inbox itself,
  `POST /note/move` moving one and refusing to replace what is already
  there, `DELETE /note` removing one and reading `404` for a file it cannot find, the graph's nodes,
  edges and unresolved links, `/link`'s refusals and its status codes with the fetcher injected, the
  plain `500` for a route that throws unexpectedly (built over a vault path that is a file, so the
  failure is real), and the CORS allow-list with the preflights a `PUT`, `PATCH` and `DELETE` need.
- `src/fetch-link.test.ts` - the link fetcher with `fetch` and DNS injected, so the suite stays
  offline: which addresses and hostnames are refused (including a redirect into the local network),
  the redirect limit, the byte cap, a missing content type, and the fact that a network error never
  leaks its detail into the message.
- `src/plan.test.ts` - `/plan` with Ollama injected: the prompt the model is sent (the day being
  planned for, the newest twenty notes and nothing older), the empty vault answered without a
  request, and every failure sentence - nothing listening, a timeout, a missing model, a bad
  status, an unreadable answer - with the socket's own words kept out of the reply.

Not covered yet: the WhatsApp session itself, which needs a real linked device, and the Tauri shell.
The routes are covered without a port, and the graph builder by the `@lumos/vault-utils` suite, both
against a temporary vault.

## Planned enhancements

The daemon's phase in the **Plan** section of [`TODO.md`](TODO.md) is closed: `/plan` with Ollama,
settings, tag extraction and the read API have all landed - a captured message's
`#hashtags` become its frontmatter tags (see [vault.md](vault.md)), and the settings come from a
config file as well as the environment (see Configuration above). The parser, the filing path,
`/find`, the link fetcher, the config loader, the plan module and the HTTP routes are covered by tests (see Tests
above).
