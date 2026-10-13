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
- **Auto-Reconnection**: Automatically reconnects on disconnects with exponential backoff
- **Sender Allowlist**: Restricts processing to pre-approved phone numbers
- **Robust Error Handling**: Graceful fallbacks and user-friendly error messages
- **Hot Reload in Dev**: Uses tsx watch for rapid development

## Architecture

```
src/
├── commands.ts  # Command parsing and type definitions
├── handler.ts   # Message routing and response generation
├── server.ts    # Fastify HTTP server + WhatsApp startup
├── vault.ts     # Markdown file writing with frontmatter
└── whatsapp.ts  # Baileys WhatsApp integration
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

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `ALLOWED_NUMBERS` | `""` (empty - blocks all) | Comma-separated list of allowed sender numbers in E.164 format without + sign. Example: `1234567890,0987654321` |
| `VAULT_PATH` | `../../vault` | Absolute or relative path to vault directory. Relative paths are resolved from cwd. |

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
node --import tsx --check src/commands.ts src/vault.ts src/handler.ts src/server.ts src/whatsapp.ts
```

## WhatsApp Authentication

On first run with `ALLOWED_NUMBERS` set, the daemon generates a QR code for linking. The authentication state is persisted in `auth_info/` directory in the daemon folder. This directory contains sensitive session data - **never commit it** (it's git-ignored).

If you get logged out, delete `auth_info/` and restart to scan a new QR code.

## Message Processing Flow

1. Message received from WhatsApp (or HTTP API)
2. Check sender against `ALLOWED_NUMBERS` allowlist - if not allowed, log and ignore
3. Extract text content (conversation, extended text, or image caption)
4. Parse with `parseMessage()` to determine command type
5. Route to appropriate handler
6. For note commands, generate filename (date-slug) and write Markdown with frontmatter
7. Send reply back to sender

## Note Format

Notes are written as Markdown files with YAML frontmatter:

```markdown
---
source: whatsapp
created: 2025-10-13T12:34:56.789Z
tags: []
status: new
url: https://example.com  # if URL was extracted
---
# Note title

Note body content
```

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
