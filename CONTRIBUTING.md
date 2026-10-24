# Contributing to Lumos

Thanks for your interest in Lumos. This is a local-first project and contributions of all sizes are
welcome — but this repository **enforces its standards**, so read [RULES.md](RULES.md) before you
start. RULES.md is the contract; this file is the practical walkthrough.

## Getting started

1. Fork and clone the repository.
2. Install dependencies from the repository root (pnpm only):
   ```bash
   pnpm install
   ```
3. Run the daemon in dev mode:
   ```bash
   pnpm --filter daemon dev
   ```
4. Run the desktop app (Vite only, fastest):
   ```bash
   pnpm --filter desktop dev
   ```
   or the full desktop window:
   ```bash
   pnpm --filter desktop tauri dev
   ```

`pnpm install` also installs the git hooks (via the `prepare` script) — don't skip it.

## Branch, then work (mandatory)

`main` is protected and always releasable. **Never commit to `main`** — the `pre-commit` hook
rejects it and `git commit --no-verify` is not an acceptable workaround.

```bash
git checkout main && git pull
git checkout -b feat/vault-search        # <type>/<short-kebab-description>
```

Prefixes match the commit types: `feat/` `fix/` `refactor/` `perf/` `docs/` `test/` `chore/` `ci/`
`hotfix/`. Keep the branch short-lived, one topic only, and rebase on `main` to catch up
(`git rebase origin/main` — never merge `main` into your branch). Full model: [RULES.md §6](RULES.md).

## Checks that run automatically

| Hook         | Runs                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `pre-commit` | blocks commits on `main`, then `lint-staged` (oxlint --fix + prettier) |
| `commit-msg` | `commitlint` — enforces `<type>(<scope>): <description>`             |
| `pre-push`   | `pnpm validate` — lint + format:check + typecheck + test + build     |

Run the same gate yourself whenever you like:

```bash
pnpm lint          # oxlint across apps + packages
pnpm format        # prettier --write .
pnpm typecheck     # tsc --noEmit in every workspace
pnpm test          # vitest run in every workspace that has a suite
pnpm test:e2e      # Playwright smoke suite against the built app (needs Chromium)
pnpm validate      # lint + format:check + typecheck + test + build
```

Tests live next to the code they cover (`*.test.ts`) and run through vitest; anything touching the
vault does it in a temporary directory built by the test, never in your real `vault/`.

The e2e smoke suite in `e2e/` is separate: it drives the *built* app in a real browser, so it needs
a Chromium download and is not part of the `pre-push` gate. CI runs it as its own job on every PR;
run `pnpm test:e2e` yourself when your change touches the built app's runtime behaviour.

A red gate blocks the commit or push. **Fix the cause — never silence the check.** No `any`, no
`@ts-ignore`/disable comments without a written reason, no skipped or weakened tests.

## Commit messages

```
<type>(<scope>): <description>
```

Valid types: `feat` · `fix` · `chore` · `docs` · `style` · `refactor` · `test` · `build` · `ci` ·
`perf` · `revert`. Imperative mood, lower case, no trailing period. `update stuff` is rejected;
`chore: update gitignore` is accepted.

## Project conventions

- **Language**: TypeScript everywhere, `strict`, **zero `any`**. Prefer explicit types on public
  interfaces; import shared types from `@lumos/shared` rather than redeclaring them.
- **Imports**: cross-package via `@lumos/*`, same-folder relative. Never `../../` chains across
  folders. Type-only imports use the `type` modifier.
- **React**: function components and hooks, shared logic in custom hooks, composition over
  prop-drilling, early returns instead of nested JSX ternaries, state colocated and derived rather
  than mirrored. The UI is dark-first and must render with the daemon down.
- **Packages**: shared logic belongs in `packages/`, never duplicated between apps. Dependencies
  point one way: apps → packages.
- **Security**: every path from a request is untrusted — validate the folder, reject `..`, and
  confirm the resolved path stays inside the vault root. Never log note contents or credentials.
- **Local-first**: do not introduce a required cloud dependency for core features.
- Keep changes minimal and focused. Match the surrounding code rather than introducing a new style.

## Before you open a pull request

- `pnpm validate` is green locally, and the same check passes in CI
  (`.github/workflows/validate.yml` runs it on every pull request into `main`).
- The docs your change affects are updated **in the same commit**: [docs/TODO.md](docs/TODO.md),
  [docs/PROGRESS.md](docs/PROGRESS.md), [docs/FEATURES.md](docs/FEATURES.md),
  [docs/LIMITATIONS.md](docs/LIMITATIONS.md), [CHANGELOG.md](CHANGELOG.md), and the matching
  `docs/*.md` reference file.
- The PR is scoped to one logical change, and its body says what changed, why, how it was verified,
  and what is still open.
- The commit message explains the *why*, not just the *what*.

## Reporting issues

Include steps to reproduce, the expected vs. actual behavior, and any relevant logs. Never paste
WhatsApp session data, the contents of `auth_info/`, or anything from `vault/` — those are private.

## Code of conduct

Be respectful and constructive. Assume good faith.
