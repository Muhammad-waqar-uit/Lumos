<p align="center">
  <img src="assets/lumos-logo-on-dark-bg.svg" alt="Lumos" width="300" />
</p>

# Lumos - Second Brain via WhatsApp

Lumos is a personal knowledge management system that lets you capture thoughts, ideas, tasks, and links directly from WhatsApp. Send a message to your Lumos number, and it automatically parses commands and saves structured Markdown notes to a local vault - ready to use with Obsidian or any Markdown editor.

## What is Lumos?

Lumos transforms WhatsApp into an effortless capture tool for your second brain. Instead of opening apps or breaking your flow, you can just send a message and have it automatically organized into folders like Ideas, Interviews, Goals, Reading, or Inbox.

![The Lumos desktop app: folders and tag chips, the note list, and the open note with its tags, status and backlinks](docs/images/notes.png)

## Features

- **WhatsApp Integration**: Link a dedicated WhatsApp number using Baileys (multi-device) - no third-party WhatsApp API keys required
- **Natural Capture**: Send plain text to Inbox, or use slash commands for organized filing
- **Structured Notes**: Each note is saved as Markdown with YAML frontmatter (timestamps, source, tags, status)
- **Local-First**: All notes are stored locally in a vault directory - your data stays yours
- **Smart Parsing**: Automatically extracts URLs from messages and preserves them in frontmatter
- **Auto-Reconnection**: Robust connection handling with automatic reconnection on disconnects
- **Allowlist Security**: Only messages from whitelisted phone numbers are processed
- **Monorepo Architecture**: One vault, three programs - the daemon captures, the desktop app browses, and an MCP server puts the notes in front of coding agents - all sharing one set of vault operations
- **Links in place**: A YouTube or Vimeo link plays in the note viewer, an Instagram reel or post and a Facebook video or post render through the platform's own embed with their caption beside them, an image link shows the image, and any other page is scraped by the daemon and read as text without leaving the app (private hosts are refused)
- **Keyboard search**: `Cmd/Ctrl+K` opens a palette over the vault - typo-tolerant matches on titles, tags and previews, plus body matches from the daemon - and `Enter` opens the note; with nothing typed it lists what you opened this session and the commands it can run itself: new note, new folder (named right in the palette), the graph, the trash
- **The link in the app**: a chip in the status bar says whether WhatsApp is linked (`WhatsApp linked`, `Pair WhatsApp`, `WhatsApp unlinked`, `WhatsApp off`) and opens a panel with the pairing code, when a message was last answered, and **Connect**/**Disconnect** - so pairing never needs the terminal, and stopping capture does not unlink the phone. A note captured while the app is open appears by itself, with a notice that names it and an **Open** button
- **Readable notes**: Markdown with tables, task lists and syntax-highlighted code, and a link plays or reads in place instead of sending you to a browser
- **Folders you make**: a folder is a directory, so `/newfolder Movies` is all it takes - `/movies <link>` files into it, and the desktop picks it up everywhere folders are offered
- **A command menu on demand**: send `/` and the bot replies with the commands your vault actually has, which is as close to autocomplete as a chat gets
- **Coding agents can read the vault**: an [MCP](https://modelcontextprotocol.io) server (`apps/mcp`) gives Claude Code, Claude Desktop or any other MCP client twelve tools over the same notes - list, search, read, create, edit, rename, move, delete, restore - so an agent works on what you actually wrote instead of what you pasted into a prompt

## Architecture

Lumos is three programs over one vault:

- **[apps/daemon](apps/daemon/README.md)** - A Node.js service that connects to WhatsApp via Baileys, exposes an HTTP API, parses commands, and writes notes to the vault
- **[apps/desktop](apps/desktop/README.md)** - A Tauri desktop app (React + TypeScript) for browsing, searching, and managing your second brain
- **[apps/mcp](apps/mcp/README.md)** - An MCP server over the same vault, for Claude Code and other agents ([docs/mcp.md](docs/mcp.md))
- **[vault/](vault/)** - Local Markdown storage (generated at runtime)

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **WhatsApp**: [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web API)
- **Server**: [Fastify](https://fastify.dev/) for HTTP API
- **Monorepo**: [pnpm workspaces](https://pnpm.io/workspaces)
- **Desktop**: [Tauri](https://tauri.app/) + [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Logging**: [Pino](https://getpino.io/)
- **Tests**: [vitest](https://vitest.dev/) - suites live beside the code as `*.test.ts` and run inside `pnpm validate`; [Playwright](https://playwright.dev/) drives the built app in a real browser (`e2e/`, `pnpm test:e2e`)

## Commands

| Command | Action | Destination |
| --- | --- | --- |
| `/idea <text>` | Save an idea | `vault/Ideas/` |
| `/interview <text or link>` | Save interview notes/resources | `vault/Interviews/` |
| `/goal <text>` | Save a goal | `vault/Goals/` |
| `/read <link>` | Save something to read | `vault/Reading/` |
| `/<folder> <text or link>` | Save into any folder you have - `/movies` into `Movies`, `/to-read` into `To Read` | that folder |
| `/newfolder <name>` | Make a folder, then `/<name>` files into it | - |
| `/` | Show the menu, built from your folders | - |
| `/plan today\|tomorrow` | Plan command - answers that it is not built yet | - |
| `/find <query>` | Search the vault (title, tags, body; five matches per reply) | - |
| `/help` | Show available commands | - |
| *(plain text)* | Quick capture | `vault/Inbox/` |

Folders are just directories, so there is no fixed set to live with: `/newfolder Movies` makes one
and `/movies <link>` files into it from then on, and it appears in the desktop's sidebar, composer,
move menus and graph on the next read. A bare `/` answers with the menu, because WhatsApp cannot
suggest commands while you type. URLs in messages are automatically detected and stored in the note's
frontmatter.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.0.0 or higher
- [pnpm](https://pnpm.io/) 9.0.0 or higher
- [Git](https://git-scm.com/)
- A spare phone number for your Lumos WhatsApp account (recommended, not required)

### Installation

```bash
# Clone the repository
git clone <your-repo-url> lumos
cd lumos

# Install dependencies
pnpm install
```

### Configuration

1. Get your phone number (country code + number, no + or spaces). This is the number you'll send messages from.
2. Set the allowlist when running the daemon:

```bash
# Windows PowerShell
$env:ALLOWED_NUMBERS="1234567890"

# macOS/Linux
export ALLOWED_NUMBERS="1234567890"
```

You can allow multiple numbers by comma-separating: `1234567890,0987654321`

### Running the Daemon

```bash
cd apps/daemon
pnpm dev
```

On first run, a QR code appears in your terminal, in the desktop's WhatsApp panel (the chip in the
status bar opens it), and at `http://127.0.0.1:3001/qrcode` as a page of its own. The chip also says
whether the link is up: `WhatsApp linked`, `Pair WhatsApp`, `WhatsApp unlinked`, `WhatsApp off`.

### Linking WhatsApp

1. Open WhatsApp on the phone number you want to use as **Lumos** (the receiving number)
2. Go to **Settings > Linked Devices > Link a Device**
3. Scan the QR code from your terminal, from the desktop's WhatsApp panel, or from the pairing page
   the daemon serves
4. The panel turns to `WhatsApp linked`, and `WhatsApp connected.` appears in the logs

The session is saved in `apps/daemon/auth_info/` - you only need to scan once. This folder is git-ignored for security.

### Usage

1. From your personal WhatsApp (the allowed number), message the Lumos number
2. Try it: `/idea Build a habit tracker`
3. Check your vault: a note like `vault/Ideas/2026-10-13-build-a-habit-tracker.md` is created
4. Open the vault in [Obsidian](https://obsidian.md/) to browse your notes

Example note:
```markdown
---
source: whatsapp
created: 2026-10-13T12:34:56.789Z
tags: []
status: new
---
# Build a habit tracker

Build a habit tracker
```

### Testing via HTTP API

You can also test the daemon directly without WhatsApp:

```bash
curl -X POST http://127.0.0.1:3001/message \
  -H "Content-Type: application/json" \
  -d '{"text":"/idea test idea"}'

curl http://127.0.0.1:3001/health
```

The daemon also serves the API the desktop uses — the read routes `GET /notes`, `/notes/search?q=`,
`/folders`, `/note?folder=&name=`, `/graph` and `/link?url=`, and the writes `PUT /note`, `POST
/notes`, `PATCH /note` (rename), `POST /note/move`, `DELETE /note`, `POST /folders`, `PATCH /folder`
(folder rename) and `DELETE /folder` (remove, notes to Inbox) — with its own guards (unknown
folders and unsafe filenames are a `400`, a name another note already holds is a `409`, local
addresses are refused by `/link`) and CORS limited to local origins and the methods it serves.
[docs/daemon.md](docs/daemon.md) documents each one.

## Configuration Reference

### Config file (Daemon)

The daemon reads `lumos.config.json` from its working directory, and the environment overrides it:

```json
{
  "vaultPath": "../../vault",
  "port": 3001,
  "allowedNumbers": ["15550100000"],
  "whatsapp": true
}
```

A missing file is fine - the defaults below apply. A bad one stops the daemon with one sentence
naming the setting. The file is git-ignored. [docs/daemon.md](docs/daemon.md) has the precedence and
the details.

### Environment Variables (Daemon)

| Variable | Default | Description |
| --- | --- | --- |
| `LUMOS_CONFIG` | `lumos.config.json` | Where to read the settings from |
| `ALLOWED_NUMBERS` | `""` | Comma-separated list of allowed sender phone numbers (country code + number) |
| `VAULT_PATH` | `../../vault` | Path to store Markdown notes (relative to daemon cwd) |
| `PORT` | `3001` | Port the daemon listens on, 1-65535 (bound to `127.0.0.1` only) |
| `LUMOS_DISABLE_WHATSAPP` | unset | Set to `1` to run the HTTP API without connecting to WhatsApp |

## Security & Privacy

- **Local-first**: Your vault and auth data never leave your machine
- **Allowlist**: Only whitelisted numbers can trigger writes
- **Ignored files**: `auth_info/` (WhatsApp session), `.env`, and vault contents are git-ignored
- **Unofficial API**: Uses Baileys (WhatsApp Web protocol). Use responsibly - avoid spam and respect WhatsApp's Terms of Service
- **Separate number recommended**: Use a dedicated number for Lumos to minimize risk

## Development

This is a pnpm monorepo. Commands can be run from root or from individual apps.

**Every change must pass `pnpm validate` before it is pushed.** The project works on a single branch, `main`; the git hooks (Husky + lint-staged + commitlint) block a badly formatted commit message or a red gate, and `pre-push` re-runs the full gate. See [RULES.md](RULES.md) for the enforced standard and [AGENTS.md](AGENTS.md) for the working agreement. GitHub Actions runs the same gate on every push ([.github/workflows/validate.yml](.github/workflows/validate.yml)).

```bash
# Install all dependencies
pnpm install

# Run daemon in dev mode (from root)
cd apps/daemon && pnpm dev

# Run the MCP server over the vault (stdio, for Claude Code and other clients)
pnpm --filter mcp start

# Lint + format check + typecheck + test + build (the gate)
pnpm validate

# Run the test suites (vitest) on their own
pnpm test

# Run the E2E smoke suite against the built app (needs Chromium once)
pnpm test:e2e

# Start from the newest main before writing any code (there is only one branch)
git checkout main && git pull
```

## Roadmap

- [x] Link expansion for `/read` and `/interview` — the daemon fetches the page and the desktop plays a video, shows an image, or reads the text in place
- [x] Daily planner with `/plan today|tomorrow` (AI-assisted via Ollama, over the newest notes in the vault)
- [x] Full-text search with `/find <query>` (title, tags and body; up to five matches per reply)
- [x] Tag extraction and auto-tagging — `#hashtags` in a captured message become the note's frontmatter tags
- [x] Tauri desktop app UI for browsing/searching/editing vault - dark shell, folder sidebar, note list, Markdown-rendering viewer with syntax-highlighted code, link graph, tag filtering, a `Cmd/Ctrl+K` search palette, typed routing, the link pane, and a composer, an editor and a set of file operations that write notes back to the vault (rename, which carries the links pointing at the note, move and delete). What is left is polish, listed in [docs/TODO.md](docs/TODO.md)
- [x] MCP server over the vault - Claude Code, Claude Desktop and any other MCP client get twelve tools (list, search, read, create, update, rename, move, delete, restore, folders) over stdio, through the same vault operations everything else uses ([docs/mcp.md](docs/mcp.md))
- [x] Test coverage - 747 vitest tests run inside `pnpm validate`: 248 for `@lumos/vault-utils`, 217 for the daemon (every route through `app.inject()`, with the link fetcher and config injected), 234 for the desktop (pure logic, SSR renders, and the panels in jsdom) and 48 for the MCP server (the operations against a temp vault, the protocol over an in-memory transport, and the entry point spawned over a real stdio pipe). A 5-test Playwright smoke suite (`pnpm test:e2e`) drives the built app in a real browser. The graph canvas is the remaining gap, tracked in [docs/TODO.md](docs/TODO.md)
- [ ] Enrichment: extract summaries, key points from links
- [ ] Sync/backups, exports

## Documentation

All project docs live in [`docs/`](docs). They are the source of truth for what is built vs being built.

Using it:

- [USAGE.md](USAGE.md) - the standalone guide: capture from WhatsApp, the desktop app, coding agents, settings, troubleshooting
- [WALKTHROUGH.md](WALKTHROUGH.md) - a fresh install, start to finish, and a ten-minute demo script

Tracking:

- [docs/PLAN.md](docs/PLAN.md) - goals, non-goals, tech stack, phases, decisions log
- [docs/TODO.md](docs/TODO.md) - actionable checklist for every phase
- [docs/PROGRESS.md](docs/PROGRESS.md) - chronological progress log
- [docs/FEATURES.md](docs/FEATURES.md) - feature status matrix
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system architecture and data flow
- [CHANGELOG.md](CHANGELOG.md) - version history
- [CONTRIBUTING.md](CONTRIBUTING.md) - how to contribute

Standards and agent docs:

- [RULES.md](RULES.md) - build, commit and git rules (enforced by git hooks)
- [AGENTS.md](AGENTS.md) - working agreement for AI agents working in this repo
- [CLAUDE.md](CLAUDE.md) - Claude Code entry point

Reference:

- [docs/daemon.md](docs/daemon.md) - daemon, commands, HTTP API, config
- [docs/desktop.md](docs/desktop.md) - desktop app architecture and layout
- [docs/vault.md](docs/vault.md) - vault format, frontmatter, conventions
- [docs/design.md](docs/design.md) - design system, dark color tokens, spacing
- [docs/roadmap.md](docs/roadmap.md) - milestones
- [docs/mcp.md](docs/mcp.md) - the MCP server: connecting a client, the tools, the trade-offs
- [docs/explainers.md](docs/explainers.md) - the planned explainers phase: what it would cost, and what would make us drop it
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) - what Lumos does not do, or does partly, and what each limit gives up

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [RULES.md](RULES.md) first: work lands on `main` with one topic per commit, the commit message must be `<type>(<scope>): <description>`, and `pnpm validate` must be green.

## License

MIT License - see [LICENSE](LICENSE) if available.

## Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) for the WhatsApp Web API implementation
- [Obsidian](https://obsidian.md/) for inspiring the vault-based second brain approach
- The PKM community for ideas on capture workflows
