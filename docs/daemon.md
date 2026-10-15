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
| `src/whatsapp.ts` | Baileys connection, QR auth, allowlist, message loop.

## Commands

| Command | Destinations |
|---|---|
| `/idea <text>` | `vault/Ideas/` |
| `/interview <text or link>` | `vault/Interviews/` |
| `/goal <text>` | `vault/Goals/` |
| `/read <link>` | `vault/Reading/` |
| `/plan today\|tomorrow` | (planned - Ollama) |
| `/find <query>` | (planned) |
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

Not covered yet: the Fastify routes (`/note`, `/notes`, `/folders`, `/message`), which need the app
built by a factory in `server.ts` so `app.inject()` can run without binding a port.

## Planned enhancements

See [`TODO.md`](TODO.md) Phase 3: link expansion, `/find`, `/plan` with Ollama, tag
extraction, a config file, and unit tests.
