# Plan 002: Add route-level tests for Cal.com webhook ingestion

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 550e8ee..HEAD -- src/app/(payload)/api/webhooks/calcom/route.ts src/app/(payload)/api/webhooks/calcom/calcomWebhook.ts src/app/(payload)/api/webhooks/calcom/__tests__/calcomWebhook.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-require-calcom-webhook-secret.md
- **Category**: tests
- **Planned at**: commit `550e8ee`, 2026-06-17

## Why This Matters

The Cal.com helper functions have unit tests, but the webhook route branches that actually create, update, cancel, reschedule, and reject requests are not tested. Recent commits show churn in cancellation state, manual payment defaults, and guided booking behavior, so route-level coverage is the best safety net before more changes. This plan adds focused tests around the route without needing a real Payload database.

## Current State

- The route verifies a signature, parses JSON, filters handled events, then uses Payload local API:

```ts
// src/app/(payload)/api/webhooks/calcom/route.ts:88
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-cal-signature-256')
    const secret = getWebhookSecret()
```

- Existing lookup helpers are private to the route:

```ts
// src/app/(payload)/api/webhooks/calcom/route.ts:22
async function findBookingByCalcomUid(payload: Payload, uid?: string | null): Promise<Booking | null> {
  if (!uid) return null
```

- Existing helper tests do not import the route:

```ts
// src/app/(payload)/api/webhooks/calcom/__tests__/calcomWebhook.test.ts:48
describe('Cal.com webhook helpers', () => {
```

- Existing test mocking pattern:

```ts
// src/views/DrugTestWizard/workflows/components/client/__tests__/uploadHeadshot.test.ts:7
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))
```

Repo conventions to match:
- Vitest runs in Node (`vitest.config.mts` sets `environment: 'node'`).
- Use `vi.mock` for Payload and framework side effects.
- Keep tests near the code under test in `__tests__/`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Route tests | `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` | exit 0, all tests pass |
| Webhook tests | `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` | exit 0, all tests pass |
| Typecheck | `pnpm exec tsc --noEmit --pretty false` | exit 0, no errors |
| Lint | `pnpm exec eslint src/app/'(payload)'/api/webhooks/calcom/route.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` | exit 0, no errors |

## Scope

**In scope**:
- `src/app/(payload)/api/webhooks/calcom/__tests__/calcomRoute.test.ts` (create)
- `src/app/(payload)/api/webhooks/calcom/route.ts` (only if minimal exports or duplicate-key handling are needed for testability)
- `src/app/(payload)/api/webhooks/calcom/calcomWebhook.ts` (only if Plan 001 changed exported helper behavior)

**Out of scope**:
- Playwright/e2e tests.
- Real MongoDB/Payload integration tests.
- Admin workflow UI tests.
- Cal.com helper refactors covered by Plan 004.

## Git Workflow

- Branch: `codex/add-calcom-webhook-route-tests`
- Commit message example: `add calcom webhook route tests`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Create a mocked route test harness

Create `src/app/(payload)/api/webhooks/calcom/__tests__/calcomRoute.test.ts`.

Mock:
- `payload` so `getPayload` returns a test double with `find`, `create`, and `update`.
- `@payload-config` with a harmless default export.
- `@/utilities/revalidateBookingViews` so route tests do not call `revalidatePath`.

Use the real `POST` route and real `NextRequest`:

```ts
const request = new NextRequest('http://localhost/api/webhooks/calcom', {
  method: 'POST',
  body: JSON.stringify(webhook),
  headers: { 'content-type': 'application/json' },
})
const response = await POST(request)
```

Keep `process.env.NODE_ENV` in `test` and leave webhook secret unset unless a case explicitly needs signature rejection.

**Verify**: `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` should run and fail only because no assertions exist yet.

### Step 2: Test create, update, ignored-event, and invalid-signature branches

Add tests proving:
- A new `BOOKING_CREATED` event with no existing UID/numeric match calls `payload.create` once and returns `201`.
- An existing booking found by UID calls `payload.update` once and returns `200`.
- An unhandled trigger event returns `200` and does not call `getPayload`.
- With a configured secret and invalid signature, the route returns `401` and does not call `getPayload`.

Use helper functions in the test file to create webhook payloads. Keep payload data small, but include `uid`, numeric `id`, `startTime`, `endTime`, attendee name/email responses, and organizer data.

**Verify**: route test command exits 0.

### Step 3: Test cancellation and reschedule behavior

Add tests proving:
- `BOOKING_CANCELLED` updates an existing booking status rather than creating a new one.
- `BOOKING_RESCHEDULED` with both original and new booking rows marks the original booking `rescheduled` and updates the new booking.

The mock `find` implementation can return results based on the `where` argument. Keep it explicit rather than overbuilding a fake database.

**Verify**: route test command exits 0 with at least six meaningful tests.

### Step 4: Keep route code testable without changing behavior

If route imports are difficult to test because private helpers are too coupled, prefer small named exports only for testable pure helpers. Do not split the route into a new service unless the current module becomes unwieldy.

**Verify**: `pnpm exec tsc --noEmit --pretty false` exits 0.

## Test Plan

- New file: `src/app/(payload)/api/webhooks/calcom/__tests__/calcomRoute.test.ts`.
- Cases: create, update, cancellation update, reschedule merge, ignored event, invalid signature.
- Existing helper test remains in `calcomWebhook.test.ts`.

## Done Criteria

- [ ] New route test file exists and imports the real `POST` route.
- [ ] Tests assert response status and `payload.create`/`payload.update` calls for route branches.
- [ ] Tests mock `revalidateBookingViews` rather than touching Next cache.
- [ ] `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` exits 0.
- [ ] `pnpm exec tsc --noEmit --pretty false` exits 0.
- [ ] `pnpm exec eslint src/app/'(payload)'/api/webhooks/calcom/route.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` exits 0.

## STOP Conditions

Stop and report if:
- Importing the route requires a real Payload config or database connection despite mocks.
- The test harness needs broad changes outside the in-scope files.
- Plan 001 has not landed or missing-secret behavior is still fail-open outside development/test.
- Route code has drifted so the branch structure no longer matches this plan.

## Maintenance Notes

These tests should be updated whenever new Cal.com trigger events become handled. Keep them focused on route behavior and leave detailed payload normalization to `calcomWebhook.test.ts`.
