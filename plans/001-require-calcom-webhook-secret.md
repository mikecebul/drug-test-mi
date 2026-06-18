# Plan 001: Require Cal.com webhook signatures outside local development

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 550e8ee..HEAD -- src/app/(payload)/api/webhooks/calcom/calcomWebhook.ts src/app/(payload)/api/webhooks/calcom/route.ts src/app/(payload)/api/webhooks/calcom/__tests__/calcomWebhook.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `550e8ee`, 2026-06-17

## Why This Matters

The Cal.com webhook route currently accepts unsigned requests whenever no webhook secret is configured. That is useful for casual local development, but unsafe in deployed environments because the route uses Payload `overrideAccess: true` to create and update operational booking records. This plan keeps local/test ergonomics while making non-development environments fail closed when the signing secret is missing or the signature is invalid.

## Current State

- `src/app/(payload)/api/webhooks/calcom/calcomWebhook.ts` contains webhook helper logic and currently treats a missing secret as valid:

```ts
// src/app/(payload)/api/webhooks/calcom/calcomWebhook.ts:115
export function verifyCalcomWebhookSignature(rawBody: string, signatureHeader: string | null, secret?: string) {
  if (!secret) return true
  if (!signatureHeader) return false
```

- `src/app/(payload)/api/webhooks/calcom/route.ts` reads the secret and relies on that helper:

```ts
// src/app/(payload)/api/webhooks/calcom/route.ts:90
const rawBody = await req.text()
const signature = req.headers.get('x-cal-signature-256')
const secret = getWebhookSecret()

if (!verifyCalcomWebhookSignature(rawBody, signature, secret)) {
  console.error('Invalid Cal.com webhook signature')
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}
```

- Existing helper tests verify valid and invalid signatures, but not missing-secret behavior:

```ts
// src/app/(payload)/api/webhooks/calcom/__tests__/calcomWebhook.test.ts:49
test('verifies Cal.com sha256 webhook signatures', () => {
  const rawBody = JSON.stringify(createWebhook())
  const secret = 'webhook-secret'
```

Repo conventions to match:
- Tests use Vitest with `describe`, `test`, and `expect`.
- Keep webhook logic in `calcomWebhook.ts`; keep route orchestration in `route.ts`.
- Do not log or expose secret values.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts` | exit 0, all tests pass |
| Typecheck | `pnpm exec tsc --noEmit --pretty false` | exit 0, no errors |
| Lint | `pnpm exec eslint src/app/'(payload)'/api/webhooks/calcom/calcomWebhook.ts src/app/'(payload)'/api/webhooks/calcom/route.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts` | exit 0, no errors |

## Scope

**In scope**:
- `src/app/(payload)/api/webhooks/calcom/calcomWebhook.ts`
- `src/app/(payload)/api/webhooks/calcom/route.ts`
- `src/app/(payload)/api/webhooks/calcom/__tests__/calcomWebhook.test.ts`

**Out of scope**:
- Cal.com booking field mapping.
- Payload collection access controls.
- Dashboard/admin UI.
- `.env.example` documentation. This can be a follow-up if desired, but this plan is only the code-level guard.

## Git Workflow

- Branch: `codex/require-calcom-webhook-secret`
- Commit message style in recent history is short imperative, for example `fix calcom booking cancellation state`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add an explicit unsigned-webhook policy

In `calcomWebhook.ts`, change missing-secret handling so unsigned webhooks are only valid in local/test contexts. Prefer a small exported helper so the behavior is testable without mutating process env throughout the route.

Target behavior:
- If `secret` is present, keep the current HMAC behavior unchanged.
- If `secret` is missing and `process.env.NODE_ENV` is `development` or `test`, allow unsigned webhooks.
- If `secret` is missing in any other environment, return false.
- Missing or malformed signature with a configured secret still returns false.

One acceptable shape:

```ts
export function allowsUnsignedCalcomWebhooks() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
}

export function verifyCalcomWebhookSignature(rawBody: string, signatureHeader: string | null, secret?: string) {
  if (!secret) return allowsUnsignedCalcomWebhooks()
  // existing signature behavior...
}
```

**Verify**: `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts` should still pass existing tests.

### Step 2: Make the route log configuration failures distinctly

In `route.ts`, keep the response body generic, but distinguish missing-secret failures in logs. Do not print any secret values.

Target behavior:
- If no secret is configured in a non-local environment, log a clear configuration error and return a non-2xx response.
- Returning `401` is acceptable for all signature failures if you want to keep the public behavior uniform. Returning `500` for missing server config is also acceptable if tests assert it intentionally.
- Invalid signatures with a configured secret should continue returning `401`.

**Verify**: `pnpm exec tsc --noEmit --pretty false` exits 0.

### Step 3: Add missing-secret tests

In `calcomWebhook.test.ts`, add tests that prove:
- Missing secret is allowed when `NODE_ENV` is `test`.
- Missing secret is rejected when `NODE_ENV` is set to `production`.
- Existing signed-request behavior still works.

Use a `try/finally` block to restore `process.env.NODE_ENV` after any mutation. Do not make tests order-dependent.

**Verify**: `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts` exits 0 and includes the new missing-secret assertions.

## Test Plan

- Extend `calcomWebhook.test.ts` rather than creating a new test file.
- Cover missing-secret local/test allowance and production rejection.
- Keep the existing valid/invalid signature assertions intact.

## Done Criteria

- [ ] `verifyCalcomWebhookSignature('{}', null, undefined)` returns true in test/development and false in production.
- [ ] Signed webhook tests still pass.
- [ ] No secret values are logged or committed.
- [ ] `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts` exits 0.
- [ ] `pnpm exec tsc --noEmit --pretty false` exits 0.
- [ ] `pnpm exec eslint src/app/'(payload)'/api/webhooks/calcom/calcomWebhook.ts src/app/'(payload)'/api/webhooks/calcom/route.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts` exits 0.

## STOP Conditions

Stop and report if:
- The current code no longer matches the excerpts above.
- The app already has a different central environment policy for webhook secrets that should be reused.
- The change requires modifying Cal.com dashboard configuration or deployment secrets.
- Focused tests fail twice after reasonable fixes.

## Maintenance Notes

Reviewers should confirm deployed environments set `CAL_WEBHOOK_SECRET` or `CALCOM_WEBHOOK_SECRET`. Future webhook routes should use the same fail-closed pattern rather than reintroducing a missing-secret bypass.
