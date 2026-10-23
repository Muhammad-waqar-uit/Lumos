# Lumos Daemon

The Lumos Daemon is the capture engine for Lumos - a Node.js service that connects to WhatsApp via Baileys, receives messages, parses commands, and saves structured Markdown notes to your local vault.

## Overview

The daemon acts as a bridge between WhatsApp and your second brain. It:
- Connects to WhatsApp using the multi-device API (Baileys)
- Receives messages from allowed senders
- Parses slash commands and routes them appropriately
- Writes well-structured Markdown files with YAML frontmatter to the vault
- Exposes a REST API for direct testing/integration

## Features

- **WhatsApp Multi-Device Support**: Uses Baileys for stable WhatsApp Web integration
- **Command Parsing**: Handles `/idea`, `/interview`, `/goal`, `/read`, `/plan`, `/find`, `/help`
- **Smart Note Generation**: Creates timestamped, slugified filenames with frontmatter
- **URL Extraction**: Automatically detects and stores URLs in note metadata
- **Hashtag Tags**: `#tags` written in a message become the note's frontmatter tags, read with the same rules the link graph uses
- **Link Fetching**: `GET /link` reads a page's title, description, lead image and readable text for the desktop, refusing anything that is not a public http(s) page
- **Auto-Reconnection**: Automatically reconnects on disconnects with exponential backoff
- **Sender Allowlist**: Restricts processing to pre-approved phone numbers
- **Robust Error Handling**: Graceful fallbacks and user-friendly error messages
- **Hot Reload in Dev**: Uses tsx watch for rapid development

## Architecture

```
src/
├── commands.ts    # Command parsing and type definitions
├── handler.ts     # Message routing and response generation
├── fetch-link.ts  # Remote page fetching for the desktop, with its guards and caps
├── app.ts         # The Fastify app: CORS + every route, built by a factory
├── server.ts      # Entry point: reads settings, builds the app, listens, starts WhatsApp
├── config.ts      # Settings from lumos.config.json, with the environment overriding it
└── whatsapp.ts    # Baileys WhatsApp integration
```

## API

### POST /message

Send a text message for processing (useful for testing without WhatsApp).

**Request Body:**
```json
{
  "text": "/idea build a habit tracker"
}
```

**Response:**
```json
{
  "reply": "Filed in Ideas: build a habit tracker"
}
```

**Error Response:**
```json
{
  "error": "text is required"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "ok": true
}
```

### Read API

The desktop reads the vault over HTTP rather than from disk. CORS is enabled for local origins only
(`localhost`, `127.0.0.1`, `tauri://`), and every path that comes from a request is checked before it
touches the vault.

| Endpoint | Returns |
| --- | --- |
| `GET /notes` | every note, newest first |
| `GET /notes/search?q=<query>` | case-insensitive matches across title, tags and body |
| `GET /folders` | note counts per folder |
| `GET /note?folder=<Folder>&name=<file.md>` | one note; `400` for an unsafe name, `404` when missing |
| `GET /graph` | the vault's link graph: notes, tags, links and unresolved targets |
| `GET /link?url=<url>` | one remote link, described for the desktop: playable media, or the page's metadata and readable text |

Five write routes serve the desktop: `PUT /note` replaces a note's body, `POST /notes` creates one
through the capture writer (stamped `source: desktop`), `PATCH /note` renames one to a new title
(the file, its first heading and the links other notes have to it all follow, and the edited files
come back as `updated`), `POST /note/move` moves it to another folder under the name it already has,
and `DELETE /note` removes it. All of them carry the same folder and filename
guards as the read routes, and a bad payload is a `400` that writes nothing. A name another note
already holds is a `409` rather than a silent replacement, and a delete has no undo - the app asks
before it sends one.

`GET /link` is the only endpoint that makes an outbound request. It accepts `http` and `https` only,
refuses local and private addresses on every redirect hop, and caps time (8 s), redirects (3) and body
size (1 MiB). A refusal is a `400` with a message, an unreachable page a `502`; the URL is never
logged. See [docs/daemon.md](../../docs/daemon.md) for the full contract and
[docs/LIMITATIONS.md](../../docs/LIMITATIONS.md) for what it deliberately cannot read.

## Configuration

Settings come from `lumos.config.json` in this folder, and the environment overrides it.

```json
{
  "vaultPath": "../../vault",
  "port": 3001,
  "allowedNumbers": ["15550100000"],
  "whatsapp": true
}
```

A relative `vaultPath` resolves against the file, not the working directory. An unknown key is
refused rather than ignored, and a setting that cannot be used stops the daemon with one sentence.
The file is git-ignored: it holds a vault path and phone numbers that belong to one machine.
`LUMOS_CONFIG` points at a different file. See [docs/daemon.md](../../docs/daemon.md) for the
precedence and every setting.

| Variable | Default | Description |
| --- | --- | --- |
| `ALLOWED_NUMBERS` | `""` (empty - blocks all) | Comma-separated list of allowed sender numbers in E.164 format without + sign. Example: `1234567890,0987654321`. Overrides the file. |
| `VAULT_PATH` | `../../vault` | Absolute or relative path to vault directory. Relative paths are resolved from cwd. Overrides the file. |
| `PORT` | `3001` | Port to listen on, 1-65535. Overrides the file. |
| `LUMOS_CONFIG` | `lumos.config.json` | Where to read the settings from. |
| `LUMOS_DISABLE_WHATSAPP` | unset | Set to `1` to run the HTTP API without connecting to WhatsApp. |

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Git

### Setup

```bash
# Install dependencies (from monorepo root or daemon dir)
pnpm install

# Development mode with hot reload
pnpm dev
```

### Type Checking

```bash
# Type-check just this workspace
pnpm typecheck

# The full gate (lint + format:check + typecheck + test + build) before you push
pnpm -w validate
```

### Tests

```bash
# The daemon suite: the command parser, the filing path, `/find`, and the link fetcher
pnpm test
```

The tests write into a temporary directory (`VAULT_PATH`), never into your `vault/`.

The daemon can run headless with `LUMOS_DISABLE_WHATSAPP=1` when you only need the HTTP API. Read [RULES.md](../../RULES.md) before contributing — commits go on a branch, never on `main`.

## WhatsApp Authentication

On first run with `ALLOWED_NUMBERS` set, the daemon generates a QR code for linking. The authentication state is persisted in `auth_info/` directory in the daemon folder. This directory contains sensitive session data - **never commit it** (it's git-ignored).

If you get logged out, delete `auth_info/` and restart to scan a new QR code.

## Message Processing Flow

1. Message received from WhatsApp (or HTTP API)
2. Check sender against `ALLOWED_NUMBERS` allowlist - if not allowed, log and ignore
3. Extract text content (conversation, extended text, or image caption)
4. Parse with `parseMessage()` to determine command type
5. Route to appropriate handler
6. For note commands, generate filename (date-slug) and write Markdown with frontmatter, taking the frontmatter `tags` from the message's `#hashtags`
7. Send reply back to sender

## Note Format

Notes are written as Markdown files with YAML frontmatter:

```markdown
---
source: whatsapp
created: 2025-10-13T12:34:56.789Z
tags:
  - travel
  - japan
status: new
url: https://example.com  # if URL was extracted
---
# Note title

Note body content
```

`tags` lists the `#hashtags` that were in the message, lower-cased and de-duplicated; it is `[]` when
there were none. A markdown heading (`# Heading`) and a `#hash` inside code are not tags. Nothing is
stripped from the body - the hashtag stays in the text as it was typed.

Filenames follow the pattern: `YYYY-MM-DD-slugified-title.md`. If a collision occurs, a timestamp suffix is added.

## Security Considerations

- **Allowlist enforcement**: Only messages from whitelisted numbers are processed
- **Local storage only**: No data sent to external services (except WhatsApp connection)
- **Auth isolation**: Session data stored locally in git-ignored directory
- **Group/Status messages ignored**: Only direct messages from individuals are processed
- **Self-messages ignored**: Messages sent by the connected account are filtered out

## Troubleshooting

### QR code doesn't appear
- Ensure `ALLOWED_NUMBERS` is set correctly
- Check terminal output for errors
- Delete `auth_info/` if corrupted

### Messages ignored
- Verify the sender number is in `ALLOWED_NUMBERS` (exact format, no +)
- Check logs - the daemon prints the detected sender ID if it doesn't match
- Some numbers may appear with different JID formats; add the logged ID if needed

### Connection drops frequently
- This is normal with WhatsApp Web API; auto-reconnect is built in
- Check network stability
- Ensure the linked device stays active

## Related

- [Root README](../../README.md) - Project overview and getting started
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API docs
