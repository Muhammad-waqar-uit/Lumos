# CLAUDE.md

Entry point for Claude Code in this repository. **Read [RULES.md](RULES.md) and
[AGENTS.md](AGENTS.md) first** — RULES.md is the enforced standard, AGENTS.md maps this specific
project. This file is the short version; where the three disagree, RULES.md wins.

## What this is

Lumos — a local-first second brain. WhatsApp messages are captured by a Fastify daemon
(`apps/daemon`) into a Markdown vault on disk, and a Tauri + React desktop app (`apps/desktop`)
browses it. Shared code lives in `packages/shared` and `packages/vault-utils`. pnpm workspace only.

## Hard rules

1. **Never commit to `main`.** Branch first — `feat/`, `fix/`, `refactor/`, `perf/`, `docs/`,
   `test/`, `chore/`, `ci/`, `hotfix/` + a short kebab description. PR into `main`, squash-merge.
2. **Never bypass the hooks.** `git commit --no-verify` and `git push --no-verify` are not options.
   Pre-commit blocks commits on `main` and runs lint-staged, commit-msg runs commitlint, pre-push
   runs `pnpm validate`.
3. **`pnpm validate` must be green** (lint + format:check + typecheck + test + build) before you finish.
   Never finish on red, and never make it green by disabling a rule.
4. **No suppressions to pass a check.** No `@ts-ignore` / `@ts-expect-error` without a written
   reason, no `eslint-disable`/`oxlint-disable` to hide a real problem, no `any`, no deleted or
   weakened assertions, no skipped tests. Fix the cause.
5. **Commit messages:** `<type>(<scope>): <description>`, imperative, lower-case, no trailing period.
   Types: `feat` `fix` `chore` `docs` `style` `refactor` `test` `build` `ci` `perf` `revert`.
6. **Keep small and focused.** One concern per branch, one concern per commit, one topic per PR.
7. **Never read, write, commit, or log `vault/`** — it holds the user's private notes.

## Working style expected here

- **Verify at the real interface, not the build.** Starting a server or building successfully is not
  proof. Exercise the endpoint, open the panel, check the response — then say what you observed.
  If a check could not run, report that plainly; never present it as a pass.
- **Report honestly.** "Done" means verified. Limitations, open questions and things you guessed at
  belong in the final message, not left implicit.
- **Docs move with the code, in the same commit.** Update [docs/TODO.md](docs/TODO.md),
  [docs/PROGRESS.md](docs/PROGRESS.md), [docs/FEATURES.md](docs/FEATURES.md),
  [docs/LIMITATIONS.md](docs/LIMITATIONS.md) and [CHANGELOG.md](CHANGELOG.md) whenever the
  corresponding state changes.
- **Match the surrounding code.** Read the neighbouring files before writing a new one; reuse the
  existing helpers and tokens instead of introducing a parallel style.
- **Ask when a decision is the user's** (scope, a trade-off, something destructive or irreversible)
  rather than guessing. For reversible details, choose sensibly and say what you chose.
- **Do not commit, push or open a PR** unless asked, and never push someone else's uncommitted work.

## Conventions that get flagged in review

- Cross-folder imports use `@lumos/*` packages or same-folder relative paths — never `../../` chains.
- Type-only imports use the `type` modifier: `import { type Note } from "@lumos/shared";`
- Zero `any` (including `Record<string, any>`): use `unknown` + narrowing, `catch (err: unknown)`.
- No floating promises; no swallowed errors (`catch {}` or log-only).
- React: function components, shared logic in custom hooks, composition over prop-drilling, early
  returns instead of nested JSX ternaries, state colocated and derived-not-mirrored.
- Server-side, treat every request path as hostile: validate the folder, reject `..`, and confirm the
  resolved path stays inside the vault root.
- The UI is dark-first and must render with the daemon down (loading / empty / error states).

## Commands

```bash
pnpm install                       # bootstrap
pnpm validate                      # the gate: lint + format:check + typecheck + test + build
pnpm test:e2e                      # Playwright smoke suite against the built app (needs Chromium)
pnpm --filter daemon dev           # daemon (LUMOS_DISABLE_WHATSAPP=1 for headless)
pnpm --filter desktop dev          # Vite UI on :1420
pnpm --filter desktop tauri dev    # full desktop window
```

Commit footer for agent-authored commits:

```
🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>
```
