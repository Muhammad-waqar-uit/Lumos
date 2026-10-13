# Contributing to Lumos

Thanks for your interest in Lumos. This is a local-first project, and contributions of all sizes are welcome.

## Getting started

1. Fork and clone the repository.
2. Install dependencies from the repository root:
   ```bash
   pnpm install
   ```
3. Run the daemon in dev mode:
   ```bash
   cd apps/daemon && pnpm dev
   ```
4. Run the desktop app:
   ```bash
   cd apps/desktop && pnpm tauri dev
   ```

## Project conventions

- **Language**: TypeScript everywhere. Prefer explicit types on public interfaces.
- **Formatting**: match the surrounding code; keep changes minimal and focused.
- **Packages**: shared logic belongs in `packages/`, not duplicated between apps.
- **Local-first**: do not introduce a required cloud dependency for core features.

## Before you open a pull request

- Run the relevant type checks (e.g. for the daemon: `node --import tsx --check src/**/*.ts`).
- Keep each pull request scoped to one logical change.
- Update the docs that your change affects (`TODO.md`, `PROGRESS.md`, `FEATURES.md`, `docs/*`) so
  the tracking docs stay accurate.
- Write a clear commit message explaining the *why*, not just the *what*.

## Reporting issues

Include steps to reproduce, the expected vs. actual behavior, and any relevant logs. Never paste
WhatsApp session data or contents of `auth_info/` - those are private credentials.

## Code of conduct

Be respectful and constructive. Assume good faith.
