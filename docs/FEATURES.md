# Lumos - Feature Status

Status values: **done** · **in-progress** · **planned** · **idea**

| Feature | Status | Notes |
|---|---|---|
| WhatsApp capture | done | Baileys multi-device, allowlist, auto-reconnect |
| Command parsing | done | `/idea`, `/interview`, `/goal`, `/read`, `/plan`, `/find`, `/help` |
| Vault writer | done | Markdown + YAML frontmatter, slugified filenames |
| HTTP API | done | `POST /message`, `GET /health` |
| Link expansion | planned | Fetch title/description/og:image for `/read` and `/interview` |
| `/find` search | planned | Search vault from the daemon |
| `/plan` with Ollama | planned | Local AI daily planning |
| Tag extraction | planned | Hashtag extraction + auto-tagging |
| Shared packages | done | `@lumos/shared` types + `@lumos/vault-utils` (parse/list/search/write) |
| Vault listing/search | done | `listNotes`, `getNotesByFolder`, `searchNotes`, `readNote` |
| Daemon read API | done | `GET /notes`, `/notes/search`, `/folders`, `/note` + CORS |
| Dark UI theme | done | Tailwind v4 tokens, near-black background |
| Desktop vault browser | in-progress | Folder sidebar + note list + viewer + status bar |
| Note viewer | in-progress | Renders note text; Markdown rendering pending |
| Full-text search UI | in-progress | Client-side filter; fuse.js + Cmd/Ctrl+K pending |
| Note editor | planned | Markdown editor with preview |
| Link enrichment | idea | Summaries and key points from links |
| Graph view | idea | Not core; revisit later |
