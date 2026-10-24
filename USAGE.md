# Using Lumos

A guide to day-to-day use: capture a note from WhatsApp, browse and edit the vault in the desktop
app, and find things again. For installation and the enforced development standard see
[README.md](README.md); for what each piece is built out of see [docs/](docs).

Lumos is local-first. Notes are Markdown files in a vault folder on your own disk, the daemon reads
and writes them over `127.0.0.1`, and nothing is uploaded anywhere.

## The two halves

| Piece | What it does | Started with |
|---|---|---|
| **Daemon** | Connects to WhatsApp, parses what you send, writes the note files, and serves the HTTP API the desktop reads | `pnpm --filter daemon dev` |
| **Desktop** | The app: folder sidebar, note list, viewer and editor, search palette, link graph, trash | `pnpm --filter desktop tauri dev` (the window) or `pnpm --filter desktop dev` (in a browser at `http://localhost:1420`) |

The desktop works with the daemon stopped - it falls back to demo notes and says so in the status
bar - so you can look around before wiring up WhatsApp.

## Capture from WhatsApp

Message the Lumos number from an allowlisted phone. A message that starts with a command picks its
folder; anything else goes to `Inbox`.

| Command | Where it lands | Notes |
|---|---|---|
| `/idea <text>` | `vault/Ideas/` | |
| `/interview <link or text>` | `vault/Interviews/` | A link is fetched for its title, description and readable text |
| `/goal <text>` | `vault/Goals/` | |
| `/read <link>` | `vault/Reading/` | Same fetch as `/interview` |
| `/plan today` / `/plan tomorrow` | no file | Replies with up to five points from your 20 newest notes, through the Ollama model on your machine |
| `/find <query>` | no file | Replies with the title and folder of up to five matches, and counts the rest |
| `/help` | no file | Prints the command list |
| plain text | `vault/Inbox/` | |

What happens to what you send:

- **The first line becomes the title** and the filename: `2026-10-25-build-a-habit-tracker.md`.
- **`#hashtags` become tags** in the frontmatter, lower-cased and de-duplicated. They are the same
  tags the tag filter and the graph use, so the file and the app cannot disagree.
- **The note is stamped** with `source: whatsapp`, `created` (ISO-8601), `tags`, and `status: new`.
- **A second note with the same title gets its own file.** Nothing is ever overwritten.

`/plan` needs [Ollama](https://ollama.com/) running with the model pulled (`ollama pull llama3.2:3b`).
If it is stopped, slow, or the model is missing, the reply says which of those it was - it never
invents a plan.

## The vault

```
vault/
  Inbox/  Ideas/  Interviews/  Goals/  Reading/
  .trash/            # what a delete keeps, until you empty it
```

Every note is a Markdown file with a YAML frontmatter block:

```markdown
---
source: whatsapp
created: 2026-10-25T09:12:04.339Z
tags: [ideas]
status: new
---

# Build a habit tracker

Build a habit tracker
```

`status` moves through `new`, `active`, `done` and `archived`; the desktop edits it, and the bulk
bar's **Archive** sets it to `archived`. The vault is a plain folder, so a hand edit or another
editor is fine - the app re-reads the listing after every write it makes. A note whose frontmatter
does not parse is still listed and readable; the viewer says what is wrong with the block instead of
hiding the note. Pointing Obsidian at the vault is the intended way to browse it outside the app.

## The desktop app

### Finding a note

- **Folders** in the sidebar, with a count per folder; **All** is the whole vault.
- **Search over the list** narrows the current folder as you type.
- **Tag chips** above the list show the tags in what you are looking at, with counts. Pick one to
  narrow; pick it again to clear. A tag on a note row does the same thing.
- **`Cmd/Ctrl+K`** opens the palette: fuzzy ranking over titles, tags and previews, plus a body
  search from the daemon for words that appear nowhere in the preview - those rows are marked *in
  the body*. Arrow keys move, `Enter` opens, `Esc` closes. Empty, it lists the notes you opened this
  session.
- **`j` / `k`** move down and up the list without leaving the viewer.

### Reading

The viewer renders Markdown: headings, lists, tables, blockquotes, task lists, links, and fenced
code with syntax highlighting for a fence that names its language. A YouTube, Vimeo, Instagram or
Facebook link plays or embeds in place; an image link renders as the image; any other link gets a
reader with the page's text.

**Backlinks** under the note list the notes that link to this one (`[[like this]]`), and each is a
button.

### Writing

- **New** opens a composer in the list's pane - folder picker and text, `Cmd/Ctrl+Enter` to file it.
  It uses the same writer as WhatsApp, so the first line is the title and hashtags become tags; the
  note is stamped `source: desktop`.
- **Edit** turns the body into a textarea with a live preview beside it. **Save** is
  `Cmd/Ctrl+S`, **Cancel** is `Esc`. Only the body is written - the frontmatter block survives
  character for character - so tags and status are edited in the strip under the header instead,
  where a chip can be removed, a tag added and the status picked.
- **`...`** in the note header holds **Rename**, **Move** and **Delete**. Rename rewrites the
  filename and the first heading together, and carries the links in other notes that pointed at
  the old title. Move keeps the filename. Delete moves the file to the vault's trash and leaves
  **Undo** in the status bar until the notice is dismissed or replaced.
- **Trash** in the sidebar lists what a delete kept, each with **Restore**; **Empty the trash**
  takes two presses because it is the one action with no undo.

A notice in the status bar is dismissed by clicking it.

### Doing something to several notes

Tick the checkbox on a row and a bulk bar appears: **Move** (a folder picker), **Add tag**,
**Archive**, and **Clear**. Each note is settled on its own, so a refusal on one - a name another
note holds, say - never abandons the rest; the status bar says what landed and repeats the first
refusal in the daemon's own words. The selection is dropped when you leave the notes pane.

### The graph

**Graph** draws the vault as a force graph: notes as nodes sized by how many notes link to them, one
hue per folder, tag nodes, and unlinked notes marked. Click a note to open it, a tag node for
**Show notes** with that filter. **Local** narrows it to the neighbourhood around the open note.
**Fit** re-frames it; the positions you see survive a tab switch, and a view you panned yourself is
left alone.

### The panes

The separator between the list and the viewer drags; double-click resets it; `←`/`→` move it from
the keyboard and `Home` resets it. The width is remembered while the app is open.

### Keys

| Key | Does |
|---|---|
| `Cmd/Ctrl+K` | Search palette (also a button in the status bar) |
| `j` / `k` | Next / previous note in the list |
| `Cmd/Ctrl+S` | Save the note being edited |
| `Esc` | Close the palette, cancel an edit |
| `Cmd/Ctrl+Enter` | File the note being composed |
| `←` `→` `Home` | Move or reset the pane separator |

## Talking to the daemon directly

The daemon is the same API the desktop uses, so anything it can do is a request away. With
`LUMOS_DISABLE_WHATSAPP=1` it runs headless:

```bash
# file a note the way a WhatsApp message would
curl -X POST http://127.0.0.1:3001/message \
  -H "Content-Type: application/json" \
  -d '{"text":"/idea build a habit tracker"}'

# the same body the palette searches
curl "http://127.0.0.1:3001/notes/search?q=habit"

# a note, then its body saved back
curl "http://127.0.0.1:3001/note?folder=Ideas&name=2026-10-25-build-a-habit-tracker.md"
```

Every route, its request shape and its refusals are in [docs/daemon.md](docs/daemon.md). The ones
you are most likely to reach for: `GET /notes`, `/notes/search`, `/note`, `/folders`, `/graph`,
`/trash`; `POST /message`, `/notes`, `/note/move`, `/note/restore`; `PUT /note`; `PATCH /note` and
`/note/meta`; `DELETE /note` and `/trash`.

## Settings

The daemon reads `lumos.config.json` from its working directory, and the environment overrides it.
A missing file means the defaults; a bad one stops the daemon with one sentence naming the setting.

```json
{
  "vaultPath": "../../vault",
  "port": 3001,
  "allowedNumbers": ["15550100000"],
  "whatsapp": true,
  "ollamaUrl": "http://127.0.0.1:11434",
  "ollamaModel": "llama3.2:3b"
}
```

| Variable | Default | What it is |
|---|---|---|
| `LUMOS_CONFIG` | `lumos.config.json` | Where the settings are read from |
| `VAULT_PATH` | `../../vault` | The vault folder. Relative paths resolve against the config file, or the working directory when there is no file |
| `PORT` | `3001` | What the daemon listens on, `127.0.0.1` only |
| `ALLOWED_NUMBERS` | empty | Comma-separated senders whose messages are filed. Empty means everyone is ignored |
| `LUMOS_DISABLE_WHATSAPP` | unset | `1` runs the HTTP API alone |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Where `/plan` asks |
| `OLLAMA_MODEL` | `llama3.2:3b` | Which model `/plan` asks |

`lumos.config.json`, `auth_info/` (the WhatsApp session) and the vault are git-ignored.

## When something goes wrong

| What you see | What it means |
|---|---|
| *Daemon offline - showing demo notes* in the status bar | The desktop could not reach `127.0.0.1:3001`. Start the daemon, or carry on looking around: the demo vault is a full copy of the interface |
| A note row says *! frontmatter* | The note's YAML block does not parse. The note is still readable and editable; the viewer lists what is wrong |
| *409* on a rename or a restore | Another note already holds that name. Nothing was replaced - choose another title |
| `400 unknown folder` | A folder outside `Inbox`, `Ideas`, `Interviews`, `Goals`, `Reading`. Nothing was written |
| The QR code never appears | `LUMOS_DISABLE_WHATSAPP=1` is set, or `whatsapp: false` in the config file |
| `/plan` replies *"… is not answering for Ollama"* | Start Ollama (`ollama serve`); `ollama list` should show the model named by `ollamaModel` |
| The port is already in use | Another daemon is running. Stop it, or set `PORT` |

Nothing in the daemon logs a message body, a note's contents, a token or the vault path.

## Where to read more

- [docs/daemon.md](docs/daemon.md) - the daemon, every command, every route, config precedence
- [docs/desktop.md](docs/desktop.md) - the app's structure, state and theming
- [docs/vault.md](docs/vault.md) - the vault format and conventions
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) - what Lumos does not do, and what each limit costs
- [docs/roadmap.md](docs/roadmap.md) - what is next
