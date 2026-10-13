# Lumos Daemon

WhatsApp bridge that receives messages, parses commands, and saves notes to your second brain vault.

## Features

- Fastify HTTP server to receive messages (port 3001)
- Command parser for `/idea`, `/interview`, `/goal`, `/read`, `/plan`, `/find`, `/help`
- Vault writer that creates Markdown files with frontmatter
- Auto-slugified filenames with timestamps to avoid collisions

## Development

```bash
# From apps/daemon
pnpm dev
```

The server watches for changes and restarts automatically.

## Environment Variables

- `VAULT_PATH` - Path to vault directory (defaults to `../../vault` relative to cwd)

## API

### POST /message
Send a message to be parsed and processed.

**Request:**
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

### GET /health
Health check endpoint.

```json
{
  "ok": true
}
```

## WhatsApp Integration

Currently the daemon exposes an HTTP API. You can integrate with WhatsApp using either:
- [Baileys](https://github.com/WhiskeySockets/Baileys) - Node.js library for WhatsApp Web API
- [WAHA](https://waha.devlike.pro/) - WhatsApp HTTP API (Docker)

The core logic (`handleMessage`, `parseMessage`, `saveNote`) is bridge-agnostic - either integration just needs to call `handleMessage(text)`.
