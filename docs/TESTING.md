# Test counts

<!--
  GENERATED FILE - do not edit by hand.
  Produced by scripts/gen-test-counts.mjs from each workspace's vitest JSON report.
  Regenerate with `pnpm counts:update`; `pnpm validate` fails when this file and the
  reports disagree, so a number here can never drift from what the suite actually ran.
-->

Counts come from the last `pnpm test`: every suite writes a `vitest-report.json`
(gitignored) beside its package, and this table is read from those files. What each
suite covers is described in [FEATURES.md](FEATURES.md); the Playwright smoke suite
(`pnpm test:e2e`, 5 tests) drives the built app in a real browser and is separate
from `pnpm validate`.

| Workspace | Tests | Test files |
| --- | ---: | ---: |
| `daemon` | 217 | 8 |
| `desktop` | 234 | 28 |
| `mcp` | 48 | 4 |
| `@lumos/vault-utils` | 248 | 4 |
| **Total** | **747** | **44** |
