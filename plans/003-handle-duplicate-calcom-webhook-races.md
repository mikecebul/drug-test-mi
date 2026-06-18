# Plan 003: Recover from duplicate Cal.com webhook create races

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 550e8ee..HEAD -- src/app/(payload)/api/webhooks/calcom/route.ts src/app/(payload)/api/webhooks/calcom/__tests__/calcomRoute.test.ts src/collections/Bookings/index.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-add-calcom-webhook-route-tests.md
- **Category**: bug
- **Planned at**: commit `550e8ee`, 2026-06-17

## Why This Matters

Cal.com webhooks can be retried or delivered close together. The route currently does a lookup-before-create flow, so two deliveries for the same new booking can both miss the lookup and race into `payload.create`. Because the `Bookings` collection has a unique Cal.com UID field, one create can fail and return a 500 even though the desired booking already exists. The route should treat duplicate-key create failures as idempotent updates.

## Current State

- The route looks up by UID and numeric id before creating:

```ts
// src/app/(payload)/api/webhooks/calcom/route.ts:112
const existingByUid = await findBookingByCalcomUid(payloadClient, uid)
const existingByNumericId = existingByUid ? null : await findBookingByCalcomNumericId(payloadClient, numericId)
```

- If no existing booking is found, it creates directly:

```ts
// src/app/(payload)/api/webhooks/calcom/route.ts:156
const booking = await createBooking(payloadClient, bookingData, req)
console.log(`Created Cal.com booking: ${booking.id}`)
return NextResponse.json({ message: 'Booking created', id: booking.id }, { status: 201 })
```

- The collection makes `calcomBookingId` unique:

```ts
// src/collections/Bookings/index.ts:237
{
  name: 'calcomBookingId',
  type: 'text',
  unique: true,
```

Repo conventions to match:
- Keep Payload local API calls in the route for webhook ingestion.
- Use `overrideAccess: true` for webhook writes.
- Revalidate booking views after successful create/update through the existing helper.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Route tests | `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` | exit 0, all tests pass |
| Webhook tests | `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` | exit 0, all tests pass |
| Typecheck | `pnpm exec tsc --noEmit --pretty false` | exit 0, no errors |
| Lint | `pnpm exec eslint src/app/'(payload)'/api/webhooks/calcom/route.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` | exit 0, no errors |

## Scope

**In scope**:
- `src/app/(payload)/api/webhooks/calcom/route.ts`
- `src/app/(payload)/api/webhooks/calcom/__tests__/calcomRoute.test.ts`

**Out of scope**:
- Changing the `Bookings` collection schema or removing the unique constraint.
- Adding transactions.
- Changing webhook payload normalization.
- Modifying dashboard/admin UI.

## Git Workflow

- Branch: `codex/fix-calcom-webhook-duplicates`
- Commit message example: `fix calcom webhook duplicate delivery handling`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a duplicate-key detector

In `route.ts`, add a small helper that recognizes duplicate-key errors from Mongo/Payload without depending on a single exact class.

It should handle common shapes:
- `error` is an object with `code === 11000`.
- `error.message` contains duplicate-key wording.
- Nested `error.cause` may hold the same shape.

Keep the helper private to the route unless tests need it exported. Do not include raw database values in logs.

**Verify**: `pnpm exec tsc --noEmit --pretty false` exits 0.

### Step 2: Wrap create paths with idempotent recovery

Add a helper like `createOrUpdateBooking(payloadClient, bookingData, req)`:
- Try `createBooking`.
- If create succeeds, return `{ booking, created: true }`.
- If create throws a duplicate-key error and `bookingData.calcomBookingId` or `bookingData.calcomBookingNumericId` exists, run the lookup again.
- If the second lookup finds a booking, update that booking with `bookingData` and return `{ booking, created: false }`.
- If the second lookup still finds nothing, rethrow the original error.

Use this helper for normal create and historical cancellation/rejection create paths.

**Verify**: route tests from Plan 002 still pass.

### Step 3: Add duplicate-delivery tests

In `calcomRoute.test.ts`, add a test where:
- Initial lookup returns no docs.
- `payload.create` rejects with `{ code: 11000, message: 'duplicate key' }`.
- The second lookup returns an existing booking.
- The route calls `payload.update` and returns `200`.

Also add a test where duplicate-key recovery cannot find the existing row and the route returns `500`, preserving the existing generic error behavior.

**Verify**: `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` exits 0.

## Test Plan

- Extend the route test file from Plan 002.
- Add two duplicate-key cases:
  - duplicate create recovers to update.
  - duplicate create with no second lookup still fails generically.
- Keep helper tests separate; this is route behavior.

## Done Criteria

- [ ] Duplicate-key create failures for same UID/numeric id no longer return 500 when a second lookup finds the booking.
- [ ] Non-duplicate create failures still return the existing generic 500 behavior.
- [ ] Historical cancellation/rejection create path uses the same duplicate recovery.
- [ ] `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` exits 0.
- [ ] `pnpm exec tsc --noEmit --pretty false` exits 0.
- [ ] No files outside the in-scope list are modified.

## STOP Conditions

Stop and report if:
- The route tests from Plan 002 do not exist yet.
- Payload errors in this project use a known structured error type that should be imported instead of duck-typed.
- Duplicate recovery requires changing the collection schema.
- The fix starts swallowing non-duplicate database errors.

## Maintenance Notes

This is not a replacement for database-level idempotency, but it makes the current unique UID design safe under ordinary webhook retries. If Cal.com later sends a stable delivery id, consider adding a dedicated processed-event ledger.
