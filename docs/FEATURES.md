# Lumos - Feature Status

Status values: **done** · **in-progress** · **planned** · **idea**

| Feature | Status | Notes |
|---|---|---|
| WhatsApp capture | done | Baileys multi-device, allowlist, auto-reconnect |
| Command parsing | done | `/idea`, `/interview`, `/goal`, `/read`, `/plan`, `/find`, `/help` |
| Vault writer | done | Markdown + YAML frontmatter, slugified filenames |
| HTTP API | done | `POST /message`, `GET /health` |
| Link expansion | done | `GET /link` reads title/description/og:image and the readable text of a page, for `/read` and `/interview` links |
| In-app playback | done | A YouTube or Vimeo link plays in the note viewer (no-cookie embed), an image link renders as the image; neither needs the daemon |
| Page reader | done | The scraped text of a link, capped at 6,000 characters, rendered as text with a loading, error and retry state |
| Link safety | done | `GET /link` refuses non-http(s) URLs, credentials in the URL, and anything local — including a redirect into a private address — with time, redirect and size caps |
| `/find` search | done | Searches title, tags and body; replies with up to five matches and counts the rest |
| `/plan` with Ollama | planned | Local AI daily planning |
| Tag extraction | planned | Hashtag extraction + auto-tagging |
| Shared packages | done | `@lumos/shared` types + `@lumos/vault-utils` (parse/list/search/write) |
| Vault listing/search | done | `listNotes`, `getNotesByFolder`, `searchNotes`, `readNote` |
| Vault graph | done | `extractLinks`/`extractTags`/`buildGraphFromNotes`/`neighborhood` in `@lumos/vault-utils` (`./graph` subpath, browser-safe) |
| Link parsing | done | `parseLinkMedia`/`extractPreview`/`firstExternalLink` in `@lumos/vault-utils` (`./link` subpath, browser-safe) |
| Daemon read API | done | `GET /notes`, `/notes/search`, `/folders`, `/note`, `/graph` + CORS |
| Dark UI theme | done | Tailwind v4 tokens, near-black background |
| Desktop vault browser | in-progress | Folder sidebar + note list + viewer + status bar |
| Note viewer | done | Markdown via `react-markdown` + `remark-gfm` (tables, task lists, fenced code) |
| Markdown rendering | done | Headings, lists, tables, blockquotes, task lists, links; styled with the dark tokens |
| Code syntax highlighting | planned | Highlight fenced code blocks in the viewer |
| Full-text search UI | in-progress | Client-side filter; fuse.js + Cmd/Ctrl+K pending |
| Note editor | planned | Markdown editor with preview |
| Link enrichment | idea | Summaries and key points from links |
| Graph view | done | Canvas force graph: glow nodes sized by backlinks, curved synapse edges, one hue per folder, tag and unlinked filters, local depth around the open note, demo graph when the daemon is offline |
| Lint + format gate | done | oxlint + prettier, run on staged files by lint-staged |
| Commit message lint | done | commitlint enforces `<type>(<scope>): <description>` |
| Pre-push validation | done | `pnpm validate` — lint + format:check + typecheck + test + build |
| Test runner | done | vitest 5; `pnpm test` runs every workspace that has a suite |
| Parser & vault tests | done | 180 tests: 99 for `@lumos/vault-utils` (link/tag extraction, graph assembly, neighbourhoods, link parsing and page metadata) and 81 for the daemon (including `/find`, the link fetcher's refusals, and every HTTP route driven through `app.inject()`) |
| Read API route tests | done | `createApp()` in `apps/daemon/src/app.ts` builds the app over a vault directory; `app.test.ts` covers every route plus CORS through `app.inject()`, with the link fetcher injected |
| Desktop component tests | planned | jsdom + Testing Library for the sidebar, list and viewer states |
| Branch workflow | done | Short-lived `<type>/<description>` branches; `pre-commit` blocks commits on `main` |
| Agent working agreement | done | `RULES.md`, `AGENTS.md`, `CLAUDE.md` at the repo root |
| CI validation | done | GitHub Actions runs `pnpm validate` on every PR into `main` and every push to `main` |
| Branch protection | planned | Require the `pnpm validate` check on `main` (repository setting) |
