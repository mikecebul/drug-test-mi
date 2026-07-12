# Merge Blockers

## `codex/new-server-test` → `main`

- [ ] Restore the production Sentry project before merging. `next.config.mjs` intentionally points this branch at
  `drug-test-branch-test`; the merge commit must point production builds back to `drug-test-mi` (or select the
  project through an environment-specific setting).

Do not merge this branch while any item above remains unchecked.
