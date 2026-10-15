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
| `src/vault.ts` | Resolves the vault path and delegates to `@lumos/vault-utils` `saveNote()`.
| `src/handler.ts` | `handleMessage()` - routes a parsed command to a reply string.
| `src/server.ts` | Fastify routes + boots the WhatsApp connection.
| `src/fetch-link.ts` | Fetches one link for the desktop, with the guards `GET /link` relies on.
| `src/whatsapp.ts` | Baileys connection, QR auth, allowlist, message loop.

## Commands

| Command | Destinations |
|---|---|
| `/idea <text>` | `vault/Ideas/` |
| `/interview <text or link>` | `vault/Interviews/` |
| `/goal <text>` | `vault/Goals/` |
| `/read <link>` | `vault/Reading/` |
| `/plan today\|tomorrow` | (planned - Ollama) |
| `/find <query>` | Search the vault; replies with the title and folder of each match |
| `/help` | prints the command list |
| plain text | `vault/Inbox/` |

## HTTP API

The daemon listens on `127.0.0.1:3001`.

### `POST /message`
```json
{ "text": "/idea build a habit tracker" }
```
Response: `{ "reply": "Filed in Ideas: build a habit tracker" }`. Missing `text` returns HTTP 400.

### `GET /health`
Response: `{ "ok": true }`.

### `GET /notes`
Every note in the vault, newest first: `{ "notes": VaultEntry[] }`.

### `GET /notes/search?q=<query>`
Case-insensitive search across titles, content, and tags: `{ "notes": VaultEntry[] }`.

### `GET /folders`
Note counts per folder: `{ "folders": [{ "folder": "Ideas", "count": 3 }] }`.

### `GET /note?folder=<Folder>&name=<file.md>`
A single note (`frontmatter` + `content`). Returns `400` for an unknown folder or an unsafe
filename, and `404` when the note is missing.

### `GET /link?url=<url>`
One link, scraped for the desktop: `{ "link": LinkCard }` — the media the app can play inline
(`kind`, `embedUrl`, `poster`) plus the page's `title`, `site`, `description`, `image` and
readable `text`. A video or an image is answered from the URL alone, with no request at all, so a
YouTube link plays with the daemon stopped.

The URL is untrusted like a vault path, so only `http` and `https` are accepted, and anything
local is refused: `localhost`, `*.local`, `*.internal`, loopback, private, link-local and
reserved addresses — including a public URL that *redirects* into them, since every hop is
checked. A URL carrying credentials is refused too. The fetch is bounded: 8 s, 3 redirects and
1 MiB of body, and the content type has to be HTML, XHTML or plain text. A refusal is a `400`
with a message, an unreachable page is a `502`; neither is a stack trace, and the URL itself is
never logged (it can carry private detail).

A name is resolved and every answer is checked, which closes the ordinary rebinding case; a name
that resolves publicly and then moves is a known, accepted limit of a reader on a personal machine.
[LIMITATIONS.md](LIMITATIONS.md) lists what the reader cannot do at all - no JavaScript, no PDFs, no
local addresses even by choice - and why each of those is deliberate.

### `GET /graph`
The vault's link graph: `{ "graph": { "nodes": GraphNode[], "edges": GraphEdge[], "unresolved":
UnresolvedLink[] } }`. Notes and tags are nodes; internal links (`[[wikilinks]]` and relative `.md`
links) and tag references are edges. A note's `inDegree` counts the notes pointing at it, and
`orphan` marks a note with no links and no tags. Links whose target does not exist are reported in
`unresolved` instead of being invented as nodes. Built by `buildVaultGraph()` from
`@lumos/vault-utils`, which reads every note body.

CORS is enabled for local development origins (`localhost`, `127.0.0.1`, `tauri://`) since the
server binds to `127.0.0.1` only.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_NUMBERS` | `""` | Comma-separated sender numbers (country code + number, no `+`). Empty blocks all. |
| `VAULT_PATH` | `../../vault` | Vault directory, relative to the daemon's working directory. |

## WhatsApp authentication

On first run a QR code is printed to the terminal. Scan it from the Lumos number's
**Settings > Linked Devices > Link a Device**. The session is stored in `apps/daemon/auth_info/`,
which is git-ignored and must never be shared. Delete it to force a fresh pairing.

## Shared packages

The daemon uses [`@lumos/shared`](../packages/shared) for its types and
[`@lumos/vault-utils`](../packages/vault-utils) for vault operations (parse, read, list, search,
write). Keeping this logic in packages lets the desktop app reuse it.

## Tests

`pnpm --filter daemon test` runs the daemon suite (vitest):

- `src/commands.test.ts` - `parseMessage` over every command and over malformed input: blank
  messages, a bare `/`, unknown commands, `https` links inside plain text, and `/plan` falling back
  to `today` for anything it does not recognise.
- `src/handler.test.ts` - `handleMessage` from the message to the file on disk: the reply strings, the
  generated filename, and the frontmatter that was written. It points `VAULT_PATH` at a temporary
  directory before importing the handler, so your own vault is never touched.
- `src/fetch-link.test.ts` - the link fetcher with `fetch` and DNS injected, so the suite stays
  offline: which addresses and hostnames are refused (including a redirect into the local network),
  the redirect limit, the byte cap, a missing content type, and the fact that a network error never
  leaks its detail into the message.

Not covered yet: the Fastify routes (`/note`, `/notes`, `/folders`, `/graph`, `/message`), which need
the app built by a factory in `server.ts` so `app.inject()` can run without binding a port. The graph
builder itself is covered by the `@lumos/vault-utils` suite, against a temporary vault.

## Planned enhancements

See [`TODO.md`](TODO.md) Phase 3: `/plan` with Ollama, tag extraction and a config file. The parser,
the filing path, `/find` and the link fetcher are covered by tests (see Tests above).
