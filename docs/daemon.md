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
| `src/vault.ts` | `saveNote()` - writes a note with YAML frontmatter, returns title + path.
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

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_NUMBERS` | `""` | Comma-separated sender numbers (country code + number, no `+`). Empty blocks all. |
| `VAULT_PATH` | `../../vault` | Vault directory, relative to the daemon's working directory. |

## WhatsApp authentication

On first run a QR code is printed to the terminal. Scan it from the Lumos number's
**Settings > Linked Devices > Link a Device**. The session is stored in `apps/daemon/auth_info/`,
which is git-ignored and must never be shared. Delete it to force a fresh pairing.

## Planned enhancements

See [`../TODO.md`](../TODO.md) Phase 3: link expansion, `/find`, `/plan` with Ollama, tag
extraction, a config file, and unit tests.
