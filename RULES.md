# RULES — Build, Commit & Branch Standards

> **Every change must pass `pnpm validate` before it is pushed.** These rules are enforced by git
> hooks and by GitHub Actions on every push to `main`. Read this file before contributing.

## 1. The validation gate (MANDATORY)

Git hooks are installed with **Husky** and **cannot be bypassed** — no `--no-verify`, no flags.

| Hook         | Runs                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| `pre-commit` | `lint-staged` on the staged files only (oxlint --fix + prettier)        |
| `commit-msg` | `commitlint` validates the message format                              |
| `pre-push`   | `pnpm validate` — lint + format:check + typecheck + test + build        |

Root scripts:

```bash
pnpm lint          # oxlint across apps + packages
pnpm format        # prettier --write .
pnpm format:check  # prettier --check .  (no writing)
pnpm typecheck     # tsc --noEmit in every workspace
pnpm test          # vitest run in every workspace that has a suite
pnpm test:e2e      # Playwright smoke suite against the built app (needs Chromium)
pnpm build         # build every workspace that has a build step
pnpm validate      # lint && format:check && typecheck && test && build — the gate that matters
```

If any check fails, the commit or push is blocked.

Tests belong beside the code they cover (`*.test.ts`, run by vitest). They run inside `pnpm validate`,
so a red suite blocks a push exactly like a red build. Anything that touches the vault does it in a
temporary directory created by the test — **tests never read or write the real `vault/`**.

The e2e smoke suite (`e2e/`, Playwright) is the one exception: it drives the *built* app in a real
browser, so it needs a browser binary and its own build. It is **not** in `pre-push` — CI runs it as
a separate job on every PR and push, and `pnpm validate` stays the local gate.

## 2. Linting & formatting

- **Linter: oxlint.** Fast, and compatible with the current TypeScript version. Config in
  [.oxlintrc.json](.oxlintrc.json).
- **Formatter: prettier** (config in [.prettierrc.json](.prettierrc.json)). Prettier owns whitespace
  and quotes — do not hand-format.
- Both run automatically on staged files via `lint-staged`; run `pnpm lint` / `pnpm format` yourself too.
- **Never silence a rule to get green.** No blanket disable comments, no `@ts-ignore` /
  `@ts-expect-error` without a comment explaining why it is unavoidable, no deleting or weakening
  assertions, no skipped tests.

## 3. TypeScript

- **One TypeScript version across the whole workspace** (`~6.0.3` everywhere). Do not mix majors.
- `strict` is on in every tsconfig. Do not relax it.
- **Zero `any`** — including `Record<string, any>`. Prefer `unknown` and narrow it; use
  `catch (err: unknown)`.
- Prefer real workspace packages (`@lumos/shared`) over `baseUrl`/`paths` magic for shared code.
- Type-only imports **must** use the `type` modifier (see §4).

## 4. Import style

Cross-package / cross-folder imports use a workspace package or alias — **never `../../` chains**.

```ts
// ✅ shared code lives in a package
import type { Note, VaultEntry } from "@lumos/shared";
import { listNotes, saveNote } from "@lumos/vault-utils";

// ✅ same-folder stays relative
import { Sidebar } from "./components/Sidebar";

// ❌ deep relative chains across folders
import { User } from "../../shared/entities/user.entity";
```

Type-only imports use the `type` modifier:

```ts
import { type Folder, FOLDERS } from "@lumos/shared"; // mixed
import type { Note } from "@lumos/shared"; // types only
```

## 5. Commit messages

Format: `<type>(<scope>): <description>` — enforced by commitlint.

Valid types: `feat` · `fix` · `chore` · `docs` · `style` · `refactor` · `test` · `build` · `ci` · `perf` · `revert`

```
feat(daemon): add /find search endpoint
fix(desktop): stop the note viewer from flickering on load
docs: record the branching model in RULES.md
chore: add husky hooks and lint-staged
```

Imperative mood, lower-case description, no trailing period. A message like `update stuff` is
**rejected** — be specific.

## 6. Branching model

This repository works on **one branch**: `main`. Commits are made there and pushed there; there is
no long-lived development branch and nothing to merge back. The history is linear, and every commit
passed the hooks on the way in.

Why: with a single author a short-lived branch adds a merge to perform and a second state to
reconcile, while the gate that actually protects `main` — `pre-commit`, `commit-msg`, `pre-push` and
GitHub Actions on every push — runs either way. What we gave up is a review step in front of `main`,
so the compensating rule is that **one commit holds one topic**: an off-topic edit goes in its own
commit, so `git revert <sha>` can take it back cleanly.

### 6.1 The loop

```bash
git checkout main && git pull      # 1. start from the newest main
# ... work ...
pnpm validate                      # 2. the full gate, before anything leaves the machine
git add <the files you touched>    # 3. never `git add -A`
git commit -m "feat(daemon): add /find endpoint"
git push                           # 4. pre-push runs validate again
```

### 6.2 Rules

- **One topic per commit.** A commit that does two unrelated things gets split.
- **Never rewrite published history** on `main` — no `git push --force`, no rebasing pushed commits.
- **Never commit on a red gate**, and never make it green by disabling a rule.
- **Never bypass the hooks** (`--no-verify`) — they are the whole review.
- **Stash or commit before switching** — never carry unrelated dirty files across a checkout.
- A risky change is still a commit, not a branch: if it has to come out, `git revert` it.

### 6.3 If branches come back

With more than one author, restore the model from git history (`git log -p -- RULES.md`): a
`<type>/<short-description>` branch per change, a PR into `main`, squash-merge, delete the branch.
`.github/workflows/validate.yml` already runs on pull requests, so nothing else has to change.

## 7. Pull requests

Pull requests are for outside contributors and for anything that should be reviewed before it lands;
the maintainer commits to `main` directly.

- Title follows the commit-message format (`feat(desktop): …`).
- Body answers: *what changed*, *why*, *how it was verified*, *what is still open*.
- Green `pnpm validate` is required, and GitHub Actions runs the same gate on every pull request
  (`.github/workflows/validate.yml`) — wait for the check to pass before asking for review. A reviewer
  does not read a red PR.
- Keep the diff focused; unrelated drive-by edits belong in their own PR.
- Reference the issue (`Closes #12`) when one exists.

## 8. Lockfiles & generated files

- **pnpm only** (this is a pnpm workspace). Commit `pnpm-lock.yaml`; never commit a `package-lock.json`.
- After changing any `package.json`, run `pnpm install` and commit the updated lockfile.
- **Never commit** `node_modules/`, `dist/`, `.next/`, `target/`, `*.tsbuildinfo`, `.env*`, or the
  `vault/`.

## 9. TypeScript & JavaScript style

- **Immutability by default.** `const` over `let`; never `var`. Build new arrays/objects instead of
  mutating shared ones (`items.map`, `[...items, x]`).
- **Pure helpers live outside components**, in `lib/` or a `*.ts` module — one responsibility each,
  named for what they return (`filterNotes`, not `processData`).
- **No floating promises.** Every promise is awaited, returned, or explicitly `.catch(...)`-ed.
- **`async/await` over `.then` chains.**
- Express the type, don't cast it: prefer `Array.isArray(x)` / a type guard
  (`function isNote(v: unknown): v is Note`) over `as`; `as` is a last resort.
- **Result-typed errors at the edge.** Wrap external calls (HTTP, filesystem) in `try/catch`, then
  surface a typed result (`{ ok: true, value } | { ok: false, error }`) or throw a domain error.
  Never swallow: `catch {}` and `catch (e) { console.log(e) }` are rejected.
- No dead code, no commented-out blocks, no unused exports. Delete it — git remembers.
- Keep functions small enough to read on one screen.

## 10. React style

- **Function components + hooks only.** No class components.
- **Custom hooks give repeated logic one home.** If two components `useState` + `useEffect` the same
  way, extract `useSomething`. A bug fix then happens once.
- **Composition over prop-drilling.** Pass `children` instead of a growing list of `title` /
  `subtitle` / `body` props; keep prop drilling shallow.
- **Early returns, not nested ternaries in JSX:**

  ```tsx
  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState />;
  return <RealUi data={data} />;
  ```

- **State colocation.** If only one component reads a piece of state, the `useState` lives there —
  not lifted to a parent "just in case".
- **Derived state, never mirrored state.** Counts, filtered lists and totals are computed at render
  from the source. Never keep a second `useState` that duplicates a calculation — it will drift.
- **Effects are for syncing with the outside world only** (subscriptions, the DOM, the network).
  A fetch on mount is fine; deriving state in an effect is not.
- **Keys are stable ids**, not array indexes.
- **Typed props.** Every component declares its `Props` interface; no `React.FC`, no implicit `any`
  children.
- Every list, loading, error and empty state has a visible UI — no silent blank screens.

## 11. UI, theme & accessibility

- **Class-driven dark mode.** This is a dark-first app: the dark palette is the default and every
  colour utility ships with its counterpart — never rely on `prefers-color-scheme`.
- Use the design tokens / shared classes in [apps/desktop/src/index.css](apps/desktop/src/index.css)
  instead of hardcoding hex values in components.
- **Accessible by default:** semantic elements (`button`, `nav`, `main`), keyboard reachable, visible
  focus rings, `aria-label` on icon-only controls, sufficient contrast.
- No `window.confirm` / `window.alert` — build a real dialog component.

## 12. Definition of done

A change is finished when **all** of these hold:

- [ ] `pnpm validate` passes locally (lint + format:check + typecheck + test + build).
- [ ] Zero `any`, zero unjustified suppressions, zero `console.log` left behind.
- [ ] New behaviour has a test beside the module (`*.test.ts`). If it genuinely cannot be tested —
      Rust/Tauri shell code, a live WhatsApp session — say so in the commit or PR body and write down
      the exact manual check that was performed.
- [ ] Docs updated in the same change: [docs/TODO.md](docs/TODO.md), [docs/PROGRESS.md](docs/PROGRESS.md),
      [CHANGELOG.md](CHANGELOG.md), and the matching [docs/](docs/) reference file.
- [ ] A new known limit is written down in [docs/LIMITATIONS.md](docs/LIMITATIONS.md), not only in a
      commit message or a TODO.
- [ ] Links still resolve (relative links checked by the [docs/](docs/) link check in CI or by hand).
- [ ] Working tree clean, branch pushed, PR opened — **never a direct commit to `main`**.
