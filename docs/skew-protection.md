# Skew Protection

This document explains the full version-skew protection setup for this repo.

## Why this exists

After a deployment, users can keep stale JavaScript in open tabs. When that stale client code calls newer server code, Next.js can fail with errors like:

- `Failed to find Server Action`
- `Server Action "..." was not found on the server`
- `ChunkLoadError`
- `Failed to fetch dynamically imported module`

Without protection, users see broken flows until they manually refresh.

## Goals

- Detect version-skew failures consistently.
- Recover automatically via one reload per unique skew token.
- Avoid infinite reload loops.
- Surface a clear post-reload notification.
- Keep non-skew/business errors handled inline.
- Preserve observability in Sentry.

## Build-time requirement

Set a stable Server Action encryption key in all deployment environments:

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

Generate once and reuse across all instances/builds:

```bash
openssl rand -base64 32
```

Related files:

- `.env.example`
- `Dockerfile`
- `README.md`

## Core utilities

Primary utility file:

- `src/lib/errors/versionSkew.ts`

Responsibilities:

- Normalize unknown thrown values with `toError`.
- Classify skew errors in `isVersionSkewError`.
- Create dedupe token with `getSkewReloadToken`.
- Queue a one-time reload + post-reload toast signal with `queueVersionSkewReload`.
- Consume pending toast flag with `consumeVersionSkewToastSignal`.

Storage keys used in `sessionStorage`:

- `last-version-reload`
- `pending-version-skew-toast`

## Safe wrapper for client-called Server Actions

Wrapper file:

- `src/lib/actions/safeServerAction.ts`

Use this when a **client component** directly calls a Server Action:

```ts
await safeServerAction(() => someServerAction(input))
```

Behavior:

- Re-throws all errors.
- On skew error: queues one-time reload signal and reloads.

## Error boundaries

Global boundaries:

- `src/app/(frontend)/global-error.tsx`
- `src/app/(payload)/global-error.tsx`

Behavior:

- Always capture error to Sentry.
- If skew is detected and reload for that token has not already run, queue signal and reload.
- Otherwise render fallback UI with retry button.

## React Query behavior (Payload/admin)

Query client:

- `src/app/(payload)/QueryClientProvider.tsx`

Behavior:

- Capture query/mutation errors to Sentry with context.
- Queries:
  - `throwOnError` only for skew errors (bubble to boundary).
  - Retry normal failures once; never retry skew failures.
- Mutations:
  - `retry: false` to prevent duplicate side effects.
  - `throwOnError` only for skew errors.

## Post-reload toast UX

Hydrator component:

- `src/components/VersionSkewToastHydrator.tsx`

Mounted in:

- `src/app/(frontend)/layout.tsx`
- `src/app/dashboard/layout.tsx`

Behavior:

- On mount, checks for pending skew-toast signal in `sessionStorage`.
- Shows Sonner info toast: `App updated. You are now on the latest version.`
- Clears signal so it only displays once.

## Tests

Key test files:

- `src/lib/errors/versionSkew.test.ts`
- `src/lib/actions/safeServerAction.test.ts`

Coverage includes:

- Skew detection signatures.
- Non-skew false positives (for example malformed JSON `Unexpected token`).
- Reload dedupe by token.
- Toast signal queue/consume behavior.

## Rule of use for new code

When adding or editing client flows:

1. If a client component directly calls a Server Action, wrap with `safeServerAction`.
2. Do not add ad-hoc skew string matching in feature files; reuse `isVersionSkewError`.
3. Keep non-skew validation/API errors inline in UI.
4. If adding new skew signatures, update tests in both utility and wrapper test files.

## Troubleshooting

- Reload does not happen:
  - Confirm error signature matches `isVersionSkewError`.
  - Confirm call path uses `safeServerAction` or a boundary catches the error.
- Toast does not show after reload:
  - Confirm `VersionSkewToastHydrator` is mounted in the active layout.
  - Confirm `pending-version-skew-toast` is set before reload.
- Repeated reloads:
  - Verify token dedupe via `last-version-reload` is preserved.
  - Verify thrown error message is stable enough to dedupe for the same failure.
