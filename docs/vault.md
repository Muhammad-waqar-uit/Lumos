# Vault

The vault is where Lumos stores your notes: a directory of plain Markdown files with YAML
frontmatter. It is Obsidian-compatible by design - open it in Obsidian, or any Markdown editor,
without conversion.

## Location

By default the vault is the `vault/` directory at the repository root (the daemon resolves
`../../vault` from its working directory). Set `VAULT_PATH` to use a different location.

The vault is git-ignored: it holds your personal notes and never belongs in version control.

## Folders

| Folder | Written by |
|---|---|
| `Inbox/` | plain text messages (no command) |
| `Ideas/` | `/idea` |
| `Interviews/` | `/interview` |
| `Goals/` | `/goal` |
| `Reading/` | `/read` |

## File naming

`YYYY-MM-DD-slug.md`, where the slug is derived from the note title (lowercased, non-alphanumerics
collapsed to hyphens, truncated). If a name already exists, a timestamp suffix is appended so no
note is ever overwritten.

## Frontmatter

```yaml
---
source: whatsapp
created: 2026-10-13T12:34:56.789Z
tags:
  - travel
  - japan
status: new
url: https://example.com   # only present when a URL was detected
---
```

| Field | Meaning |
|---|---|
| `source` | where the note came from (`whatsapp` for a capture, `desktop` for a note typed in the app, ...) |
| `created` | ISO-8601 timestamp |
| `tags` | the `#hashtags` written in the message, lower-cased, de-duplicated, in the order they appear (`[]` when there were none) |
| `status` | lifecycle marker (`new` by default) |
| `url` | first URL found in the message, if any |

Tags are read with `extractTags()` from `@lumos/vault-utils`, the same function the link graph
uses, so a tag in the frontmatter and a tag node in the graph are always the same tag. A markdown
heading (`# Heading`) and a `#hash` inside a code span or fence are not tags; `#Rust` and `#rust`
are one tag. Anything that reads the vault - Obsidian, `rg`, the desktop list - sees them.

## When the frontmatter is wrong

The vault is hand-editable, so a broken block is expected rather than exceptional. It is never a
reason to hide the note: `parseNote()` reads the body anyway, and `validateFrontmatter()` reports
what is wrong with the block.

| Checked | Reported as |
|---|---|
| the block parses as YAML | `frontmatter is not valid YAML` |
| the block is a mapping | `frontmatter is not a mapping` |
| `created` is present and parses as a date | `created is missing` / `created is not a date` |
| `tags` is a string or a list of non-empty names | `tags is not a list of names` |
| `source` is a non-empty string | `source is not a name` |
| `url` is an `http(s)` address | `url is not an http address` |

Every other key is left alone, because forward compatibility is the point of frontmatter. A field
that fails a check keeps the value that was written - the note is not rewritten and no timestamp is
invented - so the file still shows what needs fixing. The desktop shows the reasons above the note
body and marks the row in the list; the API returns them as `problems`.

## Body format

```markdown
# Note title

Note body text

https://example.com   # the URL line, if present
```

The title is the first line of the message (truncated to 60 characters, then the URL, then
`Untitled`). A hashtag in the message stays in the title and in the body as typed - it becomes a
frontmatter tag as well, rather than being stripped out of the text.

## Editing a note

The desktop can rewrite a note's body (`PUT /note` on the daemon, `updateNote()` in
`@lumos/vault-utils`). The write is deliberately narrow:

| What | How |
|---|---|
| The body | Replaced wholesale with what was submitted, trimmed. Blank lines inside it are kept |
| The frontmatter block | Left character for character as written — an invalid value, a comment, a foreign key and the block's ordering all survive |
| The filename | Unchanged. A new heading changes the *title* the app shows, not the file's name |
| The file on disk | Written to a temporary name in the same folder, then renamed over the note, so an interrupted save leaves the old note intact rather than truncated |

An empty body is a valid edit: the frontmatter stays and the note renders as empty, with its title
falling back to the filename. The write never creates a file — a name that is not already there is a
`404` — and the folder and filename are checked against the vault root before anything is read, which
is why a hand-written edit and an edit from the app cannot disagree about what a note is.

Editing `tags`, `status` or any other field from the app is not supported; those are still the file's
own business. [LIMITATIONS.md](LIMITATIONS.md) lists what that gives up.

## Renaming, moving and deleting

The file itself can be changed too (`PATCH /note`, `POST /note/move`, `DELETE /note` and
`POST /note/restore` on the daemon; `renameNote()`, `moveNote()`, `deleteNote()` and `restoreNote()`
in `@lumos/vault-utils`).

| Operation | What happens |
|---|---|
| Rename | The file becomes `<date>-<new slug>.md`, keeping the `YYYY-MM-DD-` prefix it had, and the body's first `# heading` is rewritten to the new title. A note with no heading keeps its body and only the filename changes. The links in other notes that pointed at the old title are rewritten to the new one |
| Move | The file keeps its name and its bytes and lands in another folder. The folder is created if the vault does not have it yet |
| Delete | The file moves to `.trash/<id>/<folder>/<name>`, out of every listing; `restoreNote()` moves it back under the name it had |

`.trash` is a dot-folder inside the vault, so the note listings, the folder counts and the graph skip
it without needing a rule of their own, and the file is still a plain Markdown note a person can open
with a file manager. An entry is one delete: restoring it removes the entry, and a restore refuses to
replace a note that has taken the name again. Nothing prunes the folder - a note waits there until it
is restored or deleted by hand ([LIMITATIONS.md](LIMITATIONS.md)).

Two rules hold both operations together. **Nothing is ever overwritten**: a target name another note
already holds is a `409`, not a second timestamp suffix and not a replacement, because the person
asking is there to choose another title. And **the path is checked first**: the folder and filename
are resolved against the vault root before any file is read, moved or removed, so a request cannot
reach outside the vault.

The frontmatter is untouched by all three - a rename changes the heading and the filename, never the
block above them.

A link resolves by title, so a rename carries the links that point at the note: every other note whose
body links to the old title is rewritten, in the same operation, and the API answers those files as
`updated`. The link keeps the shape it was written in - `[[Learn Rust]]` becomes the new title,
`[[2026-10-20-learn-rust.md]]` becomes the new filename - and a `#heading`, a `|alias` or an `!`
embed marker survives it. A link that still reaches the note afterwards is left alone (an alias in the
frontmatter still resolves), and so is anything inside a code fence or inline code, because the graph
does not read those as links either. [LIMITATIONS.md](LIMITATIONS.md) names what that leaves out, and
the missing undo.

## Compatibility

Everything is standard Markdown + YAML frontmatter, so any tool that understands those - Obsidian,
Foam, Logseq (with frontmatter), VS Code, `grep`, `rg` - can read the vault directly.
