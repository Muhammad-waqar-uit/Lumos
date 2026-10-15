# Lumos - Feature Status

Status values: **done** · **in-progress** · **planned** · **idea**

| Feature | Status | Notes |
|---|---|---|
| WhatsApp capture | done | Baileys multi-device, allowlist, auto-reconnect |
| Command parsing | done | `/idea`, `/interview`, `/goal`, `/read`, `/plan`, `/find`, `/help` |
| Vault writer | done | Markdown + YAML frontmatter, slugified filenames |
| HTTP API | done | `POST /message`, `GET /health` |
| Link expansion | planned | Fetch title/description/og:image for `/read` and `/interview` |
| `/find` search | done | Searches title, tags and body; replies with up to five matches and counts the rest |
| `/plan` with Ollama | planned | Local AI daily planning |
| Tag extraction | planned | Hashtag extraction + auto-tagging |
| Shared packages | done | `@lumos/shared` types + `@lumos/vault-utils` (parse/list/search/write) |
| Vault listing/search | done | `listNotes`, `getNotesByFolder`, `searchNotes`, `readNote` |
| Daemon read API | done | `GET /notes`, `/notes/search`, `/folders`, `/note` + CORS |
| Dark UI theme | done | Tailwind v4 tokens, near-black background |
| Desktop vault browser | in-progress | Folder sidebar + note list + viewer + status bar |
| Note viewer | done | Markdown via `react-markdown` + `remark-gfm` (tables, task lists, fenced code) |
| Markdown rendering | done | Headings, lists, tables, blockquotes, task lists, links; styled with the dark tokens |
| Code syntax highlighting | planned | Highlight fenced code blocks in the viewer |
| Full-text search UI | in-progress | Client-side filter; fuse.js + Cmd/Ctrl+K pending |
| Note editor | planned | Markdown editor with preview |
| Link enrichment | idea | Summaries and key points from links |
| Graph view | idea | Not core; revisit later |
| Lint + format gate | done | oxlint + prettier, run on staged files by lint-staged |
| Commit message lint | done | commitlint enforces `<type>(<scope>): <description>` |
| Pre-push validation | done | `pnpm validate` — lint + format:check + typecheck + test + build |
| Test runner | done | vitest 5; `pnpm test` runs every workspace that has a suite |
| Parser & vault tests | done | 66 tests: `parseMessage` for every command, plus save/read/list/search against a temp vault |
| Read API route tests | planned | Needs a Fastify factory in `server.ts` so `app.inject()` can run without a port |
| Desktop component tests | planned | jsdom + Testing Library for the sidebar, list and viewer states |
| Branch workflow | done | Short-lived `<type>/<description>` branches; `pre-commit` blocks commits on `main` |
| Agent working agreement | done | `RULES.md`, `AGENTS.md`, `CLAUDE.md` at the repo root |
| CI validation | planned | GitHub Actions running `pnpm validate` on every PR |
