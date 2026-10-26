# Lumos MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server over the Lumos vault: twelve
tools that let a coding agent list, search, read, write, file and delete notes, the way an Obsidian
user wires the vault into Claude Code.

It speaks MCP over **stdio** — no port, no HTTP server — and it talks to the vault through
`@lumos/vault-utils`, the same library the daemon's routes and the desktop use.

```bash
pnpm --filter mcp start                              # serves ../../vault
LUMOS_VAULT=/path/to/notes pnpm --filter mcp start   # serves another vault
pnpm --filter mcp test
```

stdout belongs to the protocol, so the vault being served is printed on stderr once. Everything else
— how to connect Claude Code or Claude Desktop, the tool list, the trade-offs and what is not tested
— is in [docs/mcp.md](../../docs/mcp.md).

```
src/vault.ts    which vault is served, and what a note key means
src/tools.ts    the vault operations, as plain functions over a directory
src/render.ts   how a result is written for the model that asked
src/server.ts   the tools, their schemas and their descriptions
src/index.ts    the stdio entry point
```

Tests sit beside the modules they cover. `server.test.ts` drives the real server over the real
protocol through the SDK's in-memory transport, so the tool list and the answers are asserted
without spawning anything; `stdio.test.ts` spawns the entry point the way a client does, so the
framing, the handshake and a clean exit on stdin close are covered too - and stdout is asserted to
carry nothing but JSON-RPC.
