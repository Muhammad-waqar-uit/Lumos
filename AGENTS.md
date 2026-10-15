# AGENTS.md — Working agreement for AI agents

> Read this before you change anything, then read [RULES.md](RULES.md). `RULES.md` is the law;
> this file is the practical map for this repository.

## What this repo is

**Lumos** — a local-first "second brain". Notes captured from WhatsApp land as Markdown files in a
vault on your own disk, and a desktop app browses them. Nothing leaves the machine.

pnpm workspace (pnpm **only** — never npm or yarn):

| Path                     | What it is                                                        |
| ------------------------ | ----------------------------------------------------------------- |
| `apps/daemon/`           | Fastify service: WhatsApp capture, message parsing, vault writes  |
| `apps/desktop/`          | Tauri 2 + React 19 + Vite desktop UI — the primary interface      |
| `packages/shared/`       | `@lumos/shared` — types shared across every workspace             |
| `packages/vault-utils/`  | `@lumos/vault-utils` — reading/writing the Markdown vault         |
| `docs/`                  | All project documentation (plan, progress, references)            |
| `vault/`                 | The user's notes. **Git-ignored. Never read, write, commit, or log it.** |

## Non-negotiables

1. **Never commit to `main`.** Every change goes on a short-lived branch and lands through a PR.
2. **`pnpm validate` must pass** before you push. Husky enforces it locally and GitHub Actions runs
   the same gate on every pull request (`.github/workflows/validate.yml`); do not bypass hooks. The
   `pre-commit` hook also refuses to commit while you are on `main`.
3. **Commit format** `<type>(<scope>): <description>` — the pre-commit and `commit-msg` hooks block
   anything else, and `git commit --no-verify` is not an option.
4. **Zero `any`**, zero unjustified suppressions, no swallowed errors, no skipped or weakened tests.
5. **Docs move with the code** in the same commit (see "Docs you must keep current").
6. **One topic per branch and per PR.** Do not mix a refactor with a feature.

## Branches — never work on `main`

```bash
git checkout main && git pull
git checkout -b feat/vault-search          # <type>/<short-kebab-description>
# ... small commits, each passing the hooks ...
pnpm validate
git push -u origin feat/vault-search       # open a PR into main, squash-merge, delete branch
```

Prefixes match the commit types: `feat/` `fix/` `refactor/` `perf/` `docs/` `test/` `chore/` `ci/`
`hotfix/`. Rebase on `main` to catch up (`git rebase origin/main`) — never merge `main` down.
Full model: [RULES.md §6](RULES.md).

## Commands

```bash
pnpm install          # bootstrap the workspace
pnpm lint             # oxlint over apps + packages
pnpm format           # prettier --write .
pnpm format:check     # prettier --check . (what validate runs)
pnpm typecheck        # tsc --noEmit in every workspace
pnpm test             # vitest run in every workspace that has a suite
pnpm build            # build every workspace that has a build step
pnpm validate         # lint + format:check + typecheck + test + build — run before every push

pnpm --filter daemon dev        # WhatsApp capture service (tsx watch)
pnpm --filter desktop dev       # Vite dev server for the UI (port 1420)
pnpm --filter desktop tauri dev # full Tauri app window
```

The daemon runs headless with `LUMOS_DISABLE_WHATSAPP=1` — use that when you only need the HTTP API.

## Architecture rules

**Daemon (`apps/daemon`)**

- Fastify on `127.0.0.1:3001`. One concern per module: `app.ts` (routes, built by a factory over a
  vault directory), `server.ts` (bootstrap), `commands.ts` (pure message parsing), `vault.ts` (vault
  path), `handler.ts` (dispatch).
- Parsing is pure and testable — it must not touch the filesystem or the network.
- **Every path that comes from a request is untrusted.** Validate the folder against the known set,
  reject `..` and absolute paths, then resolve and confirm the result is still inside the vault
  root. A `400` is the correct answer for a bad path, never a stack trace.
- CORS stays restricted to local origins.
- Never log message bodies, note contents, tokens, or the vault path.
- A malformed inbound message must be answered, not crash the daemon.

**Desktop (`apps/desktop`)**

- React 19 function components + hooks, Vite, Tauri 2. Dark-first UI.
- `src/components/` for presentational pieces, `src/lib/` for pure logic (API client, formatting,
  demo data). Keep components free of filesystem and `invoke` calls — go through `src/lib/api.ts`.
- **The app must render with the daemon down.** Every panel has a loading, empty and error state; the
  demo fallback in `src/lib/demo.ts` covers the offline case. Never leave a blank screen.
- No `useState` mutation of props, no state derived in `useEffect` that could be computed at render.
- Styling uses the Tailwind tokens in `src/index.css`. Dark-first: never rely on
  `prefers-color-scheme`, and never hardcode hex values in a component.

**Packages**

- Shared types belong in `@lumos/shared`; vault reads/writes belong in `@lumos/vault-utils`. Neither
  package may import from `apps/` — dependencies point one way, apps → packages.
- Both packages are consumed as TypeScript source; keep them dependency-light and side-effect free.

## Conventions

- **Imports:** cross-package via `@lumos/*`, same-folder relative (`./Sibling`). Never `../../`
  chains across folders. Type-only imports use the `type` modifier:
  `import { type Note, listNotes } from "@lumos/shared";`
- **Zero `any`** — including `Record<string, any>`. `unknown` + narrowing, `catch (err: unknown)`.
- **No floating promises;** every one is awaited, returned, or explicitly caught.
- **Errors are surfaced, not swallowed.** `catch {}` and log-only catches are rejected.
- **Brand the codebase:** no personal paths, no secrets, no `console.log` left behind, no
  commented-out code, no TODOs that should be an issue.
- **Never invent a dependency.** Check `pnpm-workspace.yaml` and the workspace `package.json` files
  first; if a new package is genuinely needed, say so in the PR body and commit the lockfile.

## Docs you must keep current (same commit as the code)

| File                                   | Update when                                              |
| -------------------------------------- | -------------------------------------------------------- |
| [docs/TODO.md](docs/TODO.md)            | a task is started, finished, or newly discovered         |
| [docs/PROGRESS.md](docs/PROGRESS.md)    | a phase advances or a milestone lands                    |
| [docs/FEATURES.md](docs/FEATURES.md)    | a feature's status changes (planned → built)             |
| [CHANGELOG.md](CHANGELOG.md)            | any user-visible change, under `## [Unreleased]`         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | modules, data flow or the repo layout change        |
| [docs/daemon.md](docs/daemon.md)        | endpoints, commands, or env vars change                  |
| [docs/desktop.md](docs/desktop.md)      | UI structure, state or theming changes                   |
| [docs/roadmap.md](docs/roadmap.md)      | priorities or scope move                                 |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | something is knowingly not possible, or a limit changes |

Docs are cross-linked by relative path — after moving or renaming a file, re-run the link check so
no reference dangles.

## Checks before you finish

```bash
pnpm validate      # lint + format:check + typecheck + test + build (also runs on push)
```

New behaviour gets a test beside the module it covers (`*.test.ts`). Anything that touches the vault
does it in a temp directory created by the test — never the real `vault/`. A capability that genuinely
cannot be tested (Rust shell, a live WhatsApp session) needs the exact manual check written down
instead.

Then, in prose to the user: what changed, what you actually ran, which checks passed, and what is
still open. **Never claim something works because the build succeeded** — exercise the real
interface (start the daemon and the dev server, hit the endpoint, open the panel) and describe what
you saw. If a check could not run, say so plainly instead of implying success.

## Writing style for docs and commits

Plain, specific, lower-case prose. Explain *why* over *what*. No marketing adjectives, no emoji
sprinkles. If a decision was a trade-off, name what was given up.
