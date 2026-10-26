# MCP — the vault as a tool for coding agents

Lumos ships a [Model Context Protocol](https://modelcontextprotocol.io) server: a small program a
client — Claude Code, Claude Desktop, any other MCP client — launches and talks to over stdio. It
reads and writes the same Markdown vault the app browses, so an agent can search your notes, quote
them, write into them and file them, without you copying anything into a prompt.

It lives in [`apps/mcp`](../apps/mcp) and is the answer to the question Obsidian users solve with an
MCP plugin: **the vault is the interface**. Nothing is exported, nothing is indexed into a second
store. Every call reads the disk, so a note you edited in the app or in Obsidian a second ago is
already what the agent sees.

## Running it

```bash
pnpm --filter mcp start          # a stdio server: no port, no window, no tray icon
```

The vault it serves is `vault/` in this repository, resolved from the source file rather than from
whatever directory the client happened to start in. Point it somewhere else with `LUMOS_VAULT`:

```bash
LUMOS_VAULT=/Users/me/notes pnpm --filter mcp start
```

stdout carries protocol messages and nothing else — a client reads a log line there as a malformed
message and ends the session. The vault being served is printed on stderr once at startup, because a
client that resolved the wrong directory is the failure worth seeing first; no note text or key is
ever printed.

## Connecting a client

### Claude Code

```bash
claude mcp add --scope user lumos -- pnpm --dir /absolute/path/to/lumos/apps/mcp start
```

With a vault outside this repository:

```bash
claude mcp add --scope user --env LUMOS_VAULT=/absolute/path/to/notes --transport stdio \
  lumos -- pnpm --dir /absolute/path/to/lumos/apps/mcp start
```

Three details of that syntax are load-bearing, and all three are Claude Code's rules rather than
ours: its options come **before** the server name; everything after `--` is the command, passed
through untouched, which is what keeps `--dir` from being read as Claude's own flag; and a name
placed directly after `--env` is read as another `KEY=value` pair and rejected, which is why
`--transport stdio` sits between them.

`--scope user` makes it available in every project; drop it to keep the server to the current one.
`claude mcp add` prints `Added …` when the configuration is written, `claude mcp list` shows whether
the server connects, `claude mcp get lumos` shows one server's details, and `/mcp` inside a session
lists its tools.

The server also survives being shut down the way the client does it: Claude Code closes a stdio
server's stdin and waits 300 ms before ending the process tree on Windows (SIGINT on macOS and
Linux), and this server exits as soon as stdin closes — checked by hand, exit 0.

The launcher is the package manager rather than `node`, deliberately: `tsx` resolves through this
workspace's install, so there is no build step before the first run. `pnpm --dir … start` writes its
own banner to stderr, which is why it is safe to put in front of a protocol that owns stdout — that
was measured, not assumed.

### Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lumos": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/lumos/apps/mcp", "start"],
      "env": { "LUMOS_VAULT": "/absolute/path/to/notes" }
    }
  }
}
```

Any other MCP client takes the same three facts: a command, its arguments, and the environment.

## The tools

Notes are addressed by **key** — `Folder/filename.md` — which every tool answers and every tool
accepts, so a key from one call is an argument to the next unchanged.

| Tool | What it does | Reads |
|---|---|---|
| `list_folders` | Every folder with how many notes it holds | yes |
| `list_notes` | Notes newest first, optionally one folder, with titles, tags and dates | yes |
| `search_notes` | Case-insensitive search across title, tags and body, with the start of each body so the match is visible | yes |
| `read_note` | One note in full: title, tags, status, date, body | yes |
| `create_note` | A new note in an existing folder, filed exactly as a captured message would be | no |
| `update_note` | Replaces the body, the tags or the status | no |
| `rename_note` | New title — filename, heading and the links pointing here all follow | no |
| `move_note` | Into another existing folder, keeping the name and the bytes | no |
| `delete_note` | Moves the note to the vault's trash, and answers the id that restores it | no |
| `list_trash` | What a delete kept, newest first | yes |
| `restore_note` | Puts a deleted note back where it came from | no |
| `create_folder` | Adds a folder | no |

A refusal the vault wrote — a key that is not a key, a folder that is not there, a name another
note holds — comes back as a **tool error carrying the sentence a person would read**, so the model
can act on it. An unexpected failure is thrown rather than disguised as advice.

The server also sends `instructions` at startup, which is where the guidance that no single tool can
carry lives: these are a person's own notes, read before editing, `update_note` replaces the whole
body, and a delete goes to the trash.

## What it does that the app does not need to know

- **It writes through `@lumos/vault-utils`**, the same library the daemon's routes and the desktop
  call. There is no second writer: a note an agent creates is byte-identical to one typed in the
  composer or captured on WhatsApp, apart from `source: mcp`, which is the truth about where it came
  from.
- **It never creates a folder it was not told to.** `saveNote` would `mkdir` whatever path it was
  handed; the tools check the folder against the vault's own list first, so an agent cannot quietly
  grow a top-level folder called `tmp`.
- **Every path is resolved and checked against the vault root**, so a key that walks out of the vault
  is refused before a file is read, moved or removed.
- **The mode is stdio and only stdio.** No port, no token, no network surface: the client owns the
  process, and stopping the client stops the server.

## Trade-offs

**Direct access, not through the daemon.** The obvious alternative was to have the MCP server call
the daemon's HTTP API. That would mean a coding agent cannot read your notes unless WhatsApp capture
is running, and it would put a second hop between a tool call and a file for no guard the shared
library does not already provide. Given up: the routes' HTTP-level validation is not exercised by
this path — the same functions are, and the containment check is repeated in `vault.ts` because a
read is the one operation that would otherwise hand back any file on disk.

**No folder rename or delete over MCP.** Both exist in the app and both move other people's files.
An agent gets to create a folder and file notes into it; renaming or removing one stays a decision a
person makes with the sidebar in front of them.

**`update_note` replaces the body.** The note text is sent whole, which is honest about what the
write does — a partial body would shorten the note. Given up: a small "append" tool that would be
safer for one-line additions.

## Concurrent writers

The daemon, the desktop app, an editor with the vault open and an MCP client can all write the same
file. Each write is atomic on its own — a temporary file renamed over the target — so an interrupted
save cannot truncate a note. Nothing detects a conflict: the last write wins. That is the same
bargain the editor already makes against Obsidian, and it is written down in
[LIMITATIONS.md](LIMITATIONS.md) rather than pretended away.

## Tests

44 tests, run by `pnpm test` from the root:

- `tools.test.ts` — the operations against a temporary vault: what a created note looks like on
  disk, every refusal, a rename that carries its backlinks, a delete and a restore round trip.
- `vault.test.ts` — the vault root and the key format, including every way a key can try to leave
  the vault.
- `server.test.ts` — the real server over the real protocol, through the SDK's in-memory transport:
  the tool list a client sees, the annotations that mark the read-only ones, a refusal that leaves
  the session working, a search that shows why it matched where a browse stays one line a note, and
  a delete/restore driven entirely by the text the tools answered.

The stdio entry point was checked by hand as well — a spawned process, a real `initialize`, twelve
tools, a note written and found — but no automated test spawns it, because the transport is the only
part that differs and it is the SDK's.

**Not tested: a real Claude Code session.** Signing the server into a client, and an agent choosing
the tools on its own, needs a person at a keyboard; it is listed under **Needs your testing** in
[TODO.md](TODO.md).

## Where to read more

- [ARCHITECTURE.md](ARCHITECTURE.md) — where this sits in the repo
- [vault.md](vault.md) — the file format the tools read and write
- [LIMITATIONS.md](LIMITATIONS.md) — what it will not do
- [usage](../USAGE.md) — the app and the capture side
