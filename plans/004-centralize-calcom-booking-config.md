# Plan 004: Centralize Cal.com booking config generation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 550e8ee..HEAD -- src/utilities/calcom-config.ts src/utilities/__tests__/calcom-config.test.ts src/app/dashboard/schedule/page.tsx src/components/cal-popup-button.tsx src/components/cal-inline.tsx`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `550e8ee`, 2026-06-17

## Why This Matters

Cal.com prefill behavior is split between `src/utilities/calcom-config.ts` and `src/app/dashboard/schedule/page.tsx`. The two implementations resolve referral names, phone numbers, and preferred test labels differently, which means dashboard scheduling and quick-book flows can drift as test-type rules change. Centralizing the config builder makes booking behavior easier to test and keeps shadcn-style UI components focused on rendering instead of business mapping.

## Current State

- Shared helper builds name, email, phone, referral title, and preferred test:

```ts
// src/utilities/calcom-config.ts:106
export function buildCalConfig(client: Client): Record<string, any> {
  // Validate required fields
  if (!client.firstName?.trim() || !client.lastName?.trim()) {
```

- Dashboard schedule page duplicates referral/test resolution:

```ts
// src/app/dashboard/schedule/page.tsx:18
// Helper: Extract referral organization name based on client type
function getReferralName(client: Client): string | undefined {
```

```ts
// src/app/dashboard/schedule/page.tsx:50
async function getPreferredTestLabel(client: Client): Promise<string | undefined> {
```

- Dashboard schedule page manually builds config:

```ts
// src/app/dashboard/schedule/page.tsx:107
const calConfig: Record<string, unknown> = {
  name: `${client.firstName} ${client.lastName}`,
  email: client.email,
}
```

- The button component receives a `config` object and passes it directly to Cal.com:

```ts
// src/components/cal-popup-button.tsx:71
cal('modal', {
  calLink: calUsername,
  config,
})
```

Repo conventions to match:
- Dashboard data fetching should happen in server components using Payload local API.
- Reuse `src/components/ui/` and existing shadcn-style components; do not add ad-hoc UI for this plan.
- Keep frontend layout light mode and token-based styling.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Config tests | `pnpm exec vitest run src/utilities/__tests__/calcom-config.test.ts` | exit 0, all tests pass |
| Focused tests | `pnpm exec vitest run src/utilities/__tests__/calcom-config.test.ts src/lib/__tests__/quick-book.test.ts` | exit 0, all tests pass |
| Typecheck | `pnpm exec tsc --noEmit --pretty false` | exit 0, no errors |
| Lint | `pnpm exec eslint src/utilities/calcom-config.ts src/utilities/__tests__/calcom-config.test.ts src/app/dashboard/schedule/page.tsx src/components/cal-popup-button.tsx src/components/cal-inline.tsx` | exit 0, no errors |

## Scope

**In scope**:
- `src/utilities/calcom-config.ts`
- `src/utilities/__tests__/calcom-config.test.ts`
- `src/app/dashboard/schedule/page.tsx`
- `src/components/cal-popup-button.tsx` only if its config type needs tightening.
- `src/components/cal-inline.tsx` only if its config type needs tightening.

**Out of scope**:
- Changing Cal.com event slugs.
- Changing user-facing schedule page layout.
- Changing quick-book button placement.
- Changing webhook ingestion.
- Creating new shadcn components.

## Git Workflow

- Branch: `codex/centralize-calcom-booking-config`
- Commit message example: `centralize calcom booking config`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define a typed Cal.com config shape

In `calcom-config.ts`, replace broad `Record<string, any>` return types with a shared exported type that still accepts Cal.com's known flexible values.

Suggested type:

```ts
export type CalBookingConfig = Record<string, string | string[] | Record<string, string>>
```

If Cal.com needs other value types already used in this repo, include them explicitly. Avoid `any`.

**Verify**: `pnpm exec tsc --noEmit --pretty false` exits 0.

### Step 2: Export one async dashboard config builder

Create an exported function in `calcom-config.ts` for server-side dashboard scheduling, for example:

```ts
export async function buildClientBookingCalConfig(client: Client): Promise<CalBookingConfig>
```

It should:
- Validate first name, last name, and email the same way `buildCalConfig` does.
- Format phone through the existing shared helper path. Prefer reusing `formatPhoneForCal` from `@/lib/quick-book` or making the private `formatPhone` behavior identical and tested.
- Add referral title.
- Resolve preferred test label consistently, including relationship objects and relationship ids when necessary.

If resolving a preferred test by id requires Payload local API, keep that only in the async function. Preserve a synchronous wrapper for existing client components if still needed, or update callers to use the async function only where server-side data is available.

**Verify**: config tests compile and focused tests still pass.

### Step 3: Replace schedule page duplication

In `src/app/dashboard/schedule/page.tsx`:
- Remove local `getReferralName`, `getReferralPreferredTestType`, and `getPreferredTestLabel` if the shared builder covers them.
- Replace manual `calConfig` construction with `await buildClientBookingCalConfig(client)`.
- Keep the page's existing layout and text unchanged unless TypeScript requires import cleanup.

**Verify**: `pnpm exec tsc --noEmit --pretty false` exits 0.

### Step 4: Add config tests for preferred-test behavior

Extend `calcom-config.test.ts` to cover:
- Client name/email trimming.
- US phone formatting.
- Referral title prefill.
- Preferred test chooses `bookingLabel` when available.
- Preferred test falls back to the recommended label mapping for known test values.
- Invalid phone is omitted.

Build small typed client fixtures. If full `Client` is too large, use `as Client` at the fixture boundary only; do not scatter casts through the implementation.

**Verify**: `pnpm exec vitest run src/utilities/__tests__/calcom-config.test.ts` exits 0.

### Step 5: Tighten component config types only if needed

If TypeScript complains about passing `CalBookingConfig` to `CalPopupButton` or `CalInline`, update those components to import and use the shared type. Do not change UI behavior.

**Verify**: lint command exits 0.

## Test Plan

- Extend `src/utilities/__tests__/calcom-config.test.ts`.
- Keep `src/lib/__tests__/quick-book.test.ts` passing because preferred-test resolution is shared with quick book behavior.
- No Playwright test is required for this refactor.

## Done Criteria

- [ ] `src/app/dashboard/schedule/page.tsx` no longer has its own referral/preferred-test config builder logic.
- [ ] `calcom-config.ts` exports a typed config builder used by the schedule page.
- [ ] Config tests cover phone, referral title, preferred test label, and event-link selection.
- [ ] `pnpm exec vitest run src/utilities/__tests__/calcom-config.test.ts src/lib/__tests__/quick-book.test.ts` exits 0.
- [ ] `pnpm exec tsc --noEmit --pretty false` exits 0.
- [ ] UI layout/text on the schedule page is unchanged.

## STOP Conditions

Stop and report if:
- The schedule page needs a Payload query that would duplicate an existing client fetch with different depth.
- Cal.com requires config values outside the explicit shared type and the proper type is unclear.
- Refactoring starts touching registration/admin wizard flows outside this config surface.
- Existing quick-book tests reveal a real business-rule conflict between dashboard and admin booking behavior.

## Maintenance Notes

Future Cal.com event/test mapping changes should happen in `calcom-config.ts` tests first, then the shared builder. Reviewers should be suspicious of new per-page Cal.com config builders after this plan lands.
