# Lumos

A second brain system with WhatsApp integration. Capture ideas, notes, and tasks via WhatsApp messages that get parsed and saved as Markdown files in a vault.

## Structure

- `apps/daemon` - WhatsApp bridge daemon that receives messages, parses commands, and writes notes to the vault
- `apps/desktop` - Desktop app (Tauri) for viewing and managing your second brain
- `packages/` - Shared packages (if any)
- `vault/` - Markdown note storage (auto-generated)

## Commands

The daemon understands these WhatsApp commands:

- `/idea <text>` - Save to Ideas folder
- `/interview <link or text>` - Save to Interviews folder
- `/goal <text>` - Save to Goals folder
- `/read <link>` - Save to Reading folder
- `/plan today|tomorrow` - Plan command (placeholder)
- `/find <query>` - Find command (placeholder)
- `/help` - Show available commands

Any message without a command goes to the Inbox folder.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

1. Install dependencies
   ```bash
   pnpm install
   ```

2. Start the daemon
   ```bash
   cd apps/daemon
   pnpm dev
   ```

3. Test it
   ```bash
   curl -X POST http://127.0.0.1:3001/message \
     -H "Content-Type: application/json" \
     -d '{"text":"/idea build a habit tracker"}'
   ```

Notes will be saved to `vault/` as Markdown files with YAML frontmatter.

## Development

This is a pnpm monorepo. Run commands from the root or from specific apps.

## License

MIT
