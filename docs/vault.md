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
| `source` | where the note came from (`whatsapp`, later `desktop`, ...) |
| `created` | ISO-8601 timestamp |
| `tags` | the `#hashtags` written in the message, lower-cased, de-duplicated, in the order they appear (`[]` when there were none) |
| `status` | lifecycle marker (`new` by default) |
| `url` | first URL found in the message, if any |

Tags are read with `extractTags()` from `@lumos/vault-utils`, the same function the link graph
uses, so a tag in the frontmatter and a tag node in the graph are always the same tag. A markdown
heading (`# Heading`) and a `#hash` inside a code span or fence are not tags; `#Rust` and `#rust`
are one tag. Anything that reads the vault - Obsidian, `rg`, the desktop list - sees them.

## Body format

```markdown
# Note title

Note body text

https://example.com   # the URL line, if present
```

The title is the first line of the message (truncated to 60 characters, then the URL, then
`Untitled`). A hashtag in the message stays in the title and in the body as typed - it becomes a
frontmatter tag as well, rather than being stripped out of the text.

## Compatibility

Everything is standard Markdown + YAML frontmatter, so any tool that understands those - Obsidian,
Foam, Logseq (with frontmatter), VS Code, `grep`, `rg` - can read the vault directly.
