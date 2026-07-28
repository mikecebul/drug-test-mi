# Plan 005: Reserve ToxAccess time in Google Calendar and replace it with day-of bookings

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b9233d9..HEAD -- src/lib/redwood src/lib/jobs/jobRuns.ts src/collections/Bookings src/collections/ToxAccessScheduleReservations src/app/'(payload)'/api/webhooks/calcom src/utilities/calcom-api.ts src/payload.config.ts package.json .env.example env/production.env.example docker-compose.yml docs/redwood-automation-improvements.md src/migrations src/payload-types.ts`
> If an in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `b9233d9`, 2026-07-27
- **Current state**: Upcoming-hold design is ready; day-of replacement remains
  blocked until a populated `ScheduledCollections.aspx` response can be
  captured safely.

## Live contract findings (2026-07-27)

An authorized read-only request verified the upcoming page:

- HTTP 200, page title `Abbott | ToxAccess`;
- one 14-row table with headers `Date`, `Male`, `Female`, `Unspecified`,
  `Total`;
- three upcoming collections in the current window:
  - Wednesday, 2026-07-29: one male;
  - Sunday, 2026-08-02: one male;
  - Saturday, 2026-08-08: one male;
- no donor details were captured;
- the three populated rows contain no links;
- the page exposes no start time, end time, duration, or stable per-collection
  identifier.

Read-only Cal.com API checks also verified:

- one connected Google Calendar;
- a writable Google destination calendar is configured;
- the account already has hidden and public 10-minute drug-test event types,
  all targeting Google Calendar;
- no dedicated placeholder/hold event type exists;
- all current drug-test event types inherit the same default Cal.com schedule;
- the default schedule is in `America/Detroit` and currently contains:
  - Monday-Friday: 18:00-19:00;
  - Saturday-Sunday: 10:45-11:45;
- the schedule API exposes date-specific overrides separately;
- Cal.com aligns 10-minute bookings to the next 10-minute clock boundary, so
  the 10:45 weekend opening yields a first booking time of 10:50.

**Decision**: Cal.com availability is the source of truth. The integration must
not hardcode weekday or weekend opening times and must not use free/busy data
to place random testers. For each ToxAccess date it reads the applicable
Cal.com schedule window (date override first, recurring weekday rule second),
rounds its opening up to the next 10-minute boundary, and assigns consecutive
10-minute blocks. Existing Cal.com bookings and Google Calendar busy events do
not move these blocks. For example:

- two testers in the current weekday window receive 18:00 and 18:10 even if
  another booking already exists at 18:00;
- if a date override starts at 15:00, they receive 15:00 and 15:10;
- the current weekend opening of 10:45 produces 10:50 and 11:00.

This honors regular hours, date overrides, and future schedule changes made in
Cal.com while intentionally permitting conflicts.

Create one dedicated hidden `ToxAccess Hold` event type that inherits the same
default schedule and targets the same Google destination calendar. Use that
event type to identify the applicable schedule and create placeholder bookings.
Do not reuse a normal test event type: placeholder webhook events need an
unambiguous type and metadata so they never appear in Today's Schedule.

The completed test scheduled for 2026-07-27 is no longer visible in
`ScheduledCollections.aspx`, so the day-of table contract and the join strategy
must be captured on the next live collection day before day-of replacement is
implemented.

## Why this matters

ToxAccess exposes anonymous collection dates and aggregate counts up to two
weeks ahead, then reveals the selected donor information on the collection
day. Staff need consecutive blocks beginning at the Cal.com availability
opening, regardless of other bookings, but only the day-of donor selection
should appear as a real appointment in the application's Today’s Schedule.

The smallest integration is to use Cal.com as the calendar bridge that already
exists in this repository:

```text
UpcomingScheduleCollection.aspx
        │ Monday: reserve time
        ▼
Payload reservation record ──► private Cal.com hold ──► connected Google Calendar

ScheduledCollections.aspx
        │ day-of: donor is known
        ▼
real Cal.com booking ──► Google Calendar
        │
        └── signed existing webhook ──► Bookings ──► Today’s Schedule
                                      │
                                      └── cancel the private hold
```

This avoids a second Google OAuth implementation, new Google credentials, and a
second calendar synchronization state machine. It assumes the production
Cal.com account's destination calendar is the Google Calendar that must be
blocked. That assumption is verified before any external event is created.

## Current state

- `src/lib/redwood/auth.ts:31-48` already resolves server-only ToxAccess
  credentials and the login URL.

```ts
export function resolveRedwoodAuthEnv(): RedwoodAuthEnv {
  const username = normalizeRedwoodEnvCredential(process.env.REDWOOD_USERNAME).value
  const password = normalizeRedwoodEnvCredential(process.env.REDWOOD_PASSWORD).value
  const loginUrl = process.env.REDWOOD_LOGIN_URL?.trim() || DEFAULT_REDWOOD_LOGIN_URL
```

- `src/lib/redwood/http.ts:227-308` already performs the ASP.NET Forms login,
  retains session cookies, and exposes authenticated GET/form methods. Reuse it;
  do not introduce Playwright into the production worker.
- ToxAccess allows only one active session for a username. The existing login
  helper explicitly reports that condition at `src/lib/redwood/http.ts:294-300`.
  Schedule tasks must use the existing `redwoodSessionConcurrency` key and must
  never force-close an operator's browser session.
- `src/lib/redwood/http-donor-search.ts:56-75` is the parser convention to
  follow: parse table rows with bounded helpers, strip markup through
  `stripRedwoodHtml`, and test with representative HTML.

```ts
for (const rowMatch of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
  const rowHtml = rowMatch[0]
  // ...
}
```

- `src/payload.config.ts:388-390` defines Payload tasks inline, and
  `src/payload.config.ts:126-128` serializes all ToxAccess work through one
  external session:

```ts
const redwoodSessionConcurrency = {
  key: ({ queue }: { queue: string }) => `${queue}:redwood-session`,
}
```

- `package.json:25-26` already separates the continuously polling Redwood worker
  from the Payload schedule handler. Production must run both for scheduled
  tasks to be enqueued and executed.
- `src/utilities/calcom-api.ts:22-61` currently supports cancellation only. It
  already reads `CAL_API_KEY`, which is listed as a runtime-only Dokploy value.
- The Cal.com webhook verifies `X-Cal-Signature-256` before processing at
  `src/app/(payload)/api/webhooks/calcom/route.ts:169-191`, then idempotently
  creates or updates `bookings` by Cal.com UID/numeric ID.
- Cal.com metadata is present on the webhook payload type at
  `src/app/(payload)/api/webhooks/calcom/calcomWebhook.ts`. Use only short,
  non-secret string values:

```ts
{
  source: 'toxaccess',
  kind: 'reservation' | 'collection',
  scheduleId: '<stable ToxAccess schedule id>',
  donorId: '<ToxAccess donor id, collection only>'
}
```

- `src/collections/Bookings/index.ts:110-128` requires an attendee name/email
  and links clients by relationship. The day-of integration should use a
  server-only internal attendee email in Cal.com to avoid sending unintended
  Cal.com messages to donors, then resolve `relatedClient` by the Redwood donor
  ID in the signed webhook.
- `src/views/DrugTestWizard/workflows/complete-workflow/actions.ts:308-346`
  already powers Today’s Schedule by querying confirmed/pending `bookings` in
  the application timezone. Real day-of Cal.com bookings will appear with no
  new schedule UI. Placeholder holds must never be written to `bookings`.
- The upcoming ToxAccess page contract was observed as documented in "Live
  contract findings." It provides only date and aggregate gender counts.
  The day-of page's populated-row contract, hidden IDs, pagination/postback
  behavior, and empty-state markup still must be observed from an authorized
  session before its parser is written.
- Official Payload guidance requires both a task `schedule` and a runner or
  schedule handler for recurring jobs:
  <https://payloadcms.com/docs/jobs-queue/schedules>.
- Official Cal.com booking creation supports metadata plus
  `allowConflicts`, `allowBookingOutOfBounds`, and `skipBookingLimits`:
  <https://cal.com/docs/api-reference/v2/bookings/create-a-booking>.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Generate Payload types | `pnpm generate:types` | exit 0; `src/payload-types.ts` includes the new collection, fields, and task slugs |
| Focused parser/sync tests | `pnpm exec vitest run src/lib/redwood/__tests__/schedule-pages.test.ts src/lib/redwood/__tests__/schedule-sync.test.ts src/utilities/__tests__/calcom-api.test.ts` | exit 0, all tests pass |
| Webhook tests | `pnpm exec vitest run src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomWebhook.test.ts src/app/'(payload)'/api/webhooks/calcom/__tests__/calcomRoute.test.ts` | exit 0, all tests pass |
| Booking regression tests | `pnpm exec vitest run src/views/DrugTestWizard/workflows/complete-workflow/schedule-utils.test.ts src/collections/Payments/services/calcomBookingPayment.test.ts` | exit 0, all tests pass |
| Integration suite | `pnpm test:integration:ci` | exit 0, all tests pass |
| Typecheck | `pnpm exec tsc --noEmit --pretty false` | exit 0, no errors |
| Lint | `pnpm exec eslint src/lib/redwood src/lib/jobs/jobRuns.ts src/collections/Bookings src/collections/ToxAccessScheduleReservations src/app/'(payload)'/api/webhooks/calcom src/utilities/calcom-api.ts src/payload.config.ts` | exit 0, no errors |
| Production env inventory | `pnpm validate:production-env` | exit 0 |
| Optional guided UI gate | `pnpm exec playwright test tests/e2e/wizard-guided-schedule.spec.ts` | exit 0 when the documented e2e services/env are available |

Do not run a real ToxAccess or Cal.com mutation from an automated test. External
contract checks must use a controlled test account/event type and explicit
operator supervision.

## Suggested executor toolkit

- Use the `calcom-api` skill, if available, for current API headers and request
  contracts.
- Use the Payload project guidance, if available, for collection fields,
  generated types, migrations, and scheduled task configuration.
- Read `docs/redwood-automation-improvements.md` before implementation.
- Read `src/views/DrugTestWizard/AGENTS.md` before changing any guided-schedule
  behavior. No guided UI change is expected in this plan.

## Scope

**In scope** (the only source/config files that should change):

- `src/lib/redwood/schedule-pages.ts` (create)
- `src/lib/redwood/schedule-sync.ts` (create)
- `src/lib/redwood/__tests__/schedule-pages.test.ts` (create)
- `src/lib/redwood/__tests__/schedule-sync.test.ts` (create)
- `src/lib/redwood/__tests__/fixtures/upcoming-schedule.html` (create, sanitized)
- `src/lib/redwood/__tests__/fixtures/scheduled-collections.html` (create, sanitized)
- `src/collections/ToxAccessScheduleReservations/index.ts` (create)
- `src/collections/Bookings/index.ts`
- `src/collections/Bookings/hooks/syncClient.ts` only if its early-return logic
  must account for a relationship supplied by the ToxAccess webhook
- `src/utilities/calcom-api.ts`
- `src/utilities/__tests__/calcom-api.test.ts` (create)
- `src/app/(payload)/api/webhooks/calcom/calcomWebhook.ts`
- `src/app/(payload)/api/webhooks/calcom/route.ts`
- `src/app/(payload)/api/webhooks/calcom/__tests__/calcomWebhook.test.ts`
- `src/app/(payload)/api/webhooks/calcom/__tests__/calcomRoute.test.ts`
- `src/lib/jobs/jobRuns.ts`
- `src/lib/jobs/__tests__/jobRuns.test.ts`
- `src/payload.config.ts`
- `src/payload-types.ts` (generated)
- `src/migrations/20260727_000000_add_toxaccess_schedule_reservations.ts` (create)
- `src/migrations/index.ts`
- `package.json`
- `.env.example`
- `env/production.env.example`
- `docker-compose.yml`
- `docs/redwood-automation-improvements.md`
- `plans/README.md`

**Out of scope**:

- Direct Google Calendar API/OAuth integration. Revisit only if the Cal.com
  destination-calendar preflight fails.
- Creating or changing donor records in ToxAccess.
- Force-closing an active ToxAccess session.
- Scraping result reports, specimen results, or unrelated ToxAccess pages.
- Rebuilding Today’s Schedule UI.
- Changing payment, refund, or sample-collection behavior.
- Automatically cancelling a future hold merely because it disappears from a
  two-week rolling page.
- Sending donor emails or SMS messages as part of this first version.
- Storing ToxAccess passwords, Cal.com keys, cookies, raw authenticated HTML, or
  full donor snapshots in Payload/logs.

## Git workflow

- Continue on branch: `codex/toxaccess-schedule-sync`
- Use small logical commits. Existing history uses concise imperative messages;
  examples include `Improve guided workflow validation and ToxAccess links` and
  `Fix today's schedule widget layout`.
- Suggested commits:
  1. `add toxaccess schedule page parsers`
  2. `add toxaccess calendar reservation jobs`
  3. `materialize toxaccess reservations as bookings`
  4. `document toxaccess schedule deployment`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Verify the two authenticated ToxAccess page contracts

Use an authorized, read-only session to inspect:

- `https://toxaccess.redwoodtoxicology.com/Pages/User/UpcomingScheduleCollection.aspx`
- `https://toxaccess.redwoodtoxicology.com/Pages/User/ScheduledCollections.aspx`

Do not start a second login if it would invalidate an operator's active session.
Do not accept a "close active session" prompt. Prefer a dedicated automation
username; otherwise perform the capture outside operating hours.

For the upcoming page, preserve a sanitized fixture for the verified
date/gender/count table. Treat the absence of a stable ID and time as part of
the contract; do not infer either from markup.

For the day-of page, record:

- the same stable schedule/block identifier or another unambiguous join key;
- donor ID, donor name, and any email/phone values actually present;
- actual collection start/end;
- cancellation/replacement/status values;
- pagination/postback behavior and the no-results marker.

Create sanitized structural fixtures. Replace all real names, donor IDs,
accounts, links, free text, and contact details with obvious test values while
preserving tag names, element names/IDs, header labels, date formats, and
postback/link shape. Never commit the raw pages.

The verified upcoming contract is:

```ts
export type ToxAccessUpcomingDay = {
  localDate: string
  male: number
  female: number
  unspecified: number
  total: number
}

export type ToxAccessScheduledCollection = {
  // Final fields depend on the next populated day-of page capture.
  donorId: string
  donorName: string
  localDate: string
}
```

Cal.com, not ToxAccess or application configuration, supplies each placeholder
start/end. Use the deterministic reservation key
`<localDate>:<gender>:<ordinal>` (gender order: male, female, unspecified) so
the same aggregate snapshot converges on the same reservations. This key
provides idempotency for upcoming holds, but it cannot join day-of data until a
populated day-of contract proves that match is unambiguous.

**Verify**:

- both sanitized fixture files exist;
- `rg -n -i "mike|midrugtest\\.com|310974|310872" src/lib/redwood/__tests__/fixtures`
  returns no real organization/person data;
- a human can point to the exact fixture element that supplies each required
  property above.

### Step 2: Implement strict, fixture-driven schedule parsers

Create `src/lib/redwood/schedule-pages.ts`.

Requirements:

- Reuse `resolveRedwoodAuthEnv`, `createRedwoodHttpSession`,
  `stripRedwoodHtml`, `readRedwoodHtmlAttributes`, and existing date helpers.
- Add env-backed URL resolvers with these defaults:
  - `REDWOOD_UPCOMING_SCHEDULE_URL` →
    `https://toxaccess.redwoodtoxicology.com/Pages/User/UpcomingScheduleCollection.aspx`
  - `REDWOOD_SCHEDULED_COLLECTIONS_URL` →
    `https://toxaccess.redwoodtoxicology.com/Pages/User/ScheduledCollections.aspx`
- Parse by observed header/element identity, not a fragile raw cell position
  unless the fixture proves there is no stable alternative.
- Parse upcoming dates as local calendar dates; do not invent a time or convert
  them to UTC in the page parser.
- Require non-negative integer gender counts and require `total` to equal their
  sum.
- For day-of data, normalize any observed timestamps into ISO instants using
  `APP_TIMEZONE` when they lack an offset. Reject nonexistent/ambiguous DST
  local times.
- Reject a day-of row missing any field required by its verified contract.
- Distinguish a valid empty page from parser drift. If the expected table or
  explicit empty-state marker is absent, throw; never return `[]`.
- Detect duplicate upcoming dates and any duplicate day-of stable identity
  within one response and throw.
- Follow only the pagination/postback contract actually observed in Step 1.
  Enforce a bounded page count to avoid loops.
- Do not log response bodies, credentials, cookies, or donor data.

Add unit tests for:

- one upcoming date/count row;
- multiple dates, gender counts, total validation, and header order;
- one day-of donor selection;
- valid empty pages;
- malformed dates/counts and, once observed, malformed day-of times;
- duplicate dates and missing/duplicate day-of identity;
- parser-drift HTML that must throw instead of returning an empty list;
- observed pagination/postback behavior.

**Verify**:
`pnpm exec vitest run src/lib/redwood/__tests__/schedule-pages.test.ts`
exits 0 and all cases above pass.

### Step 3: Add a durable reservation collection and source fields

Create `src/collections/ToxAccessScheduleReservations/index.ts` with admin-only
read access, system-only writes, and these fields:

- `externalScheduleId`: required text, indexed, unique, read-only in admin;
- `startTime` and `endTime`: required date/time;
- `status`: required select:
  `pending | reserved | replacement-pending | materialized | manual-review | cancelled`;
- `placeholderCalcomBookingId`: text, indexed, unique when present;
- `actualCalcomBookingId`: text, indexed when present;
- `actualBooking`: relationship to `bookings`;
- `sourceFingerprint`: text used to detect upstream aggregate changes without
  retaining raw HTML;
- `lastSeenAt`, `reservedAt`, `materializedAt`: date/time;
- `lastError`: textarea;
- `missingFromLatestSnapshot`: checkbox, default false.

Register the collection next to `Bookings` in `src/payload.config.ts`.

Add optional fields to `Bookings`:

- `bookingSource`: select with `toxaccess` as the first new explicit value;
  leave legacy/Cal.com/walk-in records unset rather than backfilling guesses;
- `redwoodScheduleId`: indexed, unique when present;
- `redwoodDonorId`: indexed text.

Make `attendeeEmail` optional only if Step 1 confirms the day-of page does not
provide one. Existing Cal.com webhook records still populate it. Audit all
TypeScript consumers and normalize a missing value to `''` only at form
boundaries.

Create and register
`src/migrations/20260727_000000_add_toxaccess_schedule_reservations.ts`.
The migration must create the new collection/indexes without rewriting existing
bookings. The down migration must remove only indexes/collection state introduced
by this plan; it must not delete or rewrite normal booking data.

Run `pnpm generate:types` after the schema is final.

**Verify**:

- `pnpm generate:types` exits 0;
- `rg -n "ToxAccessScheduleReservation|redwoodScheduleId|redwoodDonorId" src/payload-types.ts`
  returns the generated types/fields;
- `pnpm exec tsc --noEmit --pretty false` exits 0.

### Step 4: Extend the Cal.com server client for holds and real bookings

Refactor `src/utilities/calcom-api.ts` around one private authenticated request
helper. Preserve `cancelCalcomBooking`'s current return contract for guided
workflow callers.

Add typed helpers for:

- `getCalcomCalendarConnection()` / destination-calendar preflight;
- `getCalcomEventTypeSchedule(eventTypeId)`;
- `resolveCalcomScheduleBlocks({ schedule, localDate, count, duration: 10 })`;
- `listCalcomBookings({ afterStart, beforeEnd })` with pagination;
- `createCalcomBooking(...)`;
- existing cancellation.

All v2 requests must include:

- `Authorization: Bearer <CAL_API_KEY>`;
- `Content-Type: application/json` when there is a body;
- the current required `cal-api-version` header, pinned as a named constant and
  covered by tests.

Schedule lookup and creation requests use one private event type from
`REDWOOD_CALCOM_EVENT_TYPE_ID` and the server-only internal attendee address
from `REDWOOD_CALCOM_ATTENDEE_EMAIL`.

The schedule helper must call authenticated `GET /v2/schedules` with API
version `2024-06-11`, select the schedule assigned to the dedicated hold event
type (the default schedule when its `scheduleId` is null), and retain:

- schedule timezone;
- recurring availability day/start/end windows;
- date-specific overrides.

For a ToxAccess local date:

1. Use an exact-date override when present; otherwise use the recurring
   availability window containing that weekday.
2. When multiple windows apply, choose the earliest start.
3. Round the start up to the next 10-minute clock boundary.
4. Generate one consecutive 10-minute interval per aggregate collection.
5. Require every generated interval to end within the selected availability
   window.

Do not call the slots/free-busy endpoint to place random testers. If no schedule
window applies or all required intervals do not fit, create no holds for that
date and surface `manual-review`.

For a placeholder:

```ts
{
  start: block.startTime,
  eventTypeId,
  attendee: {
    name: 'Reserved - ToxAccess collection',
    email: internalAttendeeEmail,
    timeZone: APP_TIMEZONE
  },
  lengthInMinutes,
  metadata: {
    source: 'toxaccess',
    kind: 'reservation',
    scheduleId: block.externalScheduleId
  },
  allowConflicts: true,
  allowBookingOutOfBounds: true,
  skipBookingLimits: true
}
```

`allowConflicts` and `skipBookingLimits` are required for every placeholder
creation so a random-test hold can overlap a pre-existing ordinary booking and
can bypass per-day limits. Random-test holds on the same date remain
consecutive rather than overlapping one another. Pin booking creation to
Cal.com API version `2026-02-25`; these bypasses are effective only when the
authenticated API user is a host of the event type. Verify that condition in
the supervised rehearsal.

For the real day-of booking, use the donor name and metadata kind
`collection`, add `donorId`, and set `allowConflicts: true`. The real booking is
created before the placeholder is cancelled so a partial failure cannot leave
the calendar unexpectedly open.

Requirements:

- Parse and return Cal.com UID, numeric ID, start, end, metadata, and attendee.
- Respect `Retry-After` on 429 by returning/throwing a retryable failure; do not
  spin inside the request helper.
- Redact credentials and attendee/donor data from errors and logs.
- The list helper must support recovering a Cal.com booking by
  `source + kind + scheduleId` after a process crash between external creation
  and the Payload update.

Add mocked-fetch tests for headers, request bodies, pagination, 401/403, 429,
5xx, malformed success responses, and network errors.

**Verify**:
`pnpm exec vitest run src/utilities/__tests__/calcom-api.test.ts` exits 0.

### Step 5: Implement the Monday reservation sync

In `src/lib/redwood/schedule-sync.ts`, implement
`syncUpcomingToxAccessReservations(payload)`.

At the start:

- assert `REDWOOD_AUTOMATION_ENABLED`;
- assert a separate `REDWOOD_SCHEDULE_AUTOMATION_ENABLED` kill switch;
- assert ToxAccess schedule URLs, Cal event type ID, internal attendee email,
  and Cal API key;
- call the calendar preflight and require the configured Cal.com destination
  calendar integration to be Google Calendar.

For each parsed upcoming date:

1. Expand aggregate gender counts into deterministic reservation keys such as
   `2026-07-29:male:1`.
2. Atomically upsert reservations by that derived key.
3. Skip existing reservations that already have a placeholder booking.
4. Resolve the date's Cal.com override/recurring availability opening and
   generate consecutive 10-minute blocks from its rounded opening.
5. Create the holds with conflict and booking-limit bypasses, preserving the
   generated order, and persist each UID/timestamps.
6. If no schedule applies or the intervals do not fit inside its window, create
   none for that date and require manual review.

For each assigned reservation:

1. Use the derived reservation key as `externalScheduleId`.
2. If an existing reservation already has a matching source fingerprint and a
   placeholder UID, mark `lastSeenAt`, clear the missing flag, and do nothing
   externally.
3. If the Payload row lacks a placeholder UID, list Cal.com bookings in the
   relevant window and recover a matching metadata tuple before creating.
4. If no matching Cal.com hold exists, create one and persist its UID/timestamps.
5. Do not move an existing hold merely because Cal.com availability later
   changes; Cal.com schedule changes do not reschedule existing bookings.
6. If an operator explicitly requests a move, create the replacement first,
   persist it, then cancel the old hold.

After processing the snapshot:

- mark previously tracked, still-future rows inside the verified page window as
  `missingFromLatestSnapshot=true` when absent;
- do **not** cancel them automatically in v1;
- set `manual-review` and surface a concise job summary so an upstream removal
  cannot silently leave or remove calendar time;
- never mark rows outside the current two-week source window as missing.

Return counts for `created`, `unchanged`, `updated`, `recovered`, and
`manualReview`.

Tests must cover weekday availability, weekend 10:45→10:50 rounding, exact-date
override precedence, multiple consecutive blocks, existing bookings not being
queried, conflict/booking-limit bypass flags on every hold, missing/too-short
schedule windows, idempotent rerun, crash recovery from Cal.com metadata, valid
empty snapshot, parser drift, and rolling-window absence.

**Verify**:
`pnpm exec vitest run src/lib/redwood/__tests__/schedule-sync.test.ts` exits 0.

### Step 6: Implement day-of materialization and hold replacement

Add `materializeTodaysToxAccessCollections(payload)` to
`src/lib/redwood/schedule-sync.ts`.

For each day-of row:

1. Match exactly one reservation using the verified day-of join established
   from the next populated page capture. This may be a stable upstream ID or an
   unambiguous date/gender/occurrence tuple; do not implement this step before
   that evidence exists.
2. If `bookings.redwoodScheduleId` or a Cal.com metadata search already finds
   the real booking, recover its UID and skip creation.
3. Otherwise create the real Cal.com booking **before** cancelling the hold.
4. Persist `actualCalcomBookingId` and set `replacement-pending`.
5. Cancel the placeholder Cal.com booking.
6. Mark the reservation `materialized` only after the real UID is durable and
   placeholder cancellation has succeeded.

Retries must converge:

- actual exists, hold exists → cancel hold only;
- actual exists, hold already cancelled → mark materialized;
- actual creation fails → keep hold reserved;
- hold cancellation fails → keep the real booking and retry cancellation;
- no matching reservation or ambiguous match → manual review, no external
  mutation.

Do not trust name-only matching. The donor ID from ToxAccess may be used to
resolve a Payload client, but it is not a substitute for the verified day-of
join that identifies the placeholder being replaced.

Return counts for `created`, `recovered`, `materialized`, `unchanged`, and
`manualReview`.

**Verify**:
the focused schedule-sync test command passes with explicit tests for every
retry state above.

### Step 7: Teach the signed Cal.com webhook about ToxAccess metadata

In `calcomWebhook.ts`, add pure metadata readers for:

- normal Cal.com booking;
- ToxAccess placeholder (`source=toxaccess`, `kind=reservation`);
- ToxAccess actual collection (`source=toxaccess`, `kind=collection` with
  schedule/donor IDs).

In `route.ts`, after signature verification and JSON parsing but before normal
booking lookup:

- return 200 for placeholder created/cancelled/rescheduled events without
  writing to `bookings`, payments, or Today’s Schedule;
- for an actual collection, require the schedule ID and donor ID;
- find at most one Payload client whose `redwoodDonorId` matches;
- enrich the booking write with:
  - `bookingSource: 'toxaccess'`;
  - `redwoodScheduleId`;
  - `redwoodDonorId`;
  - `relatedClient` and that client's real email when there is exactly one
    verified match;
- leave the booking unlinked and email absent when no client matches;
- fail/manual-review on multiple client matches instead of choosing one;
- after the booking upsert, update the reservation's `actualBooking`,
  `actualCalcomBookingId`, and materialization state.

The webhook remains the authoritative path that creates the application
`Booking`; the schedule job must not duplicate its booking-mapping logic.
Existing normal Cal.com payload behavior and payment synchronization must stay
unchanged.

Add route/pure-function tests for:

- signed placeholder create and cancel are acknowledged but ignored;
- actual metadata creates a ToxAccess booking;
- exact donor-ID client link;
- no donor match leaves registration required without a fake email;
- duplicate webhook delivery updates the same booking;
- missing schedule/donor metadata fails closed;
- ordinary Cal.com webhooks retain current behavior;
- invalid/unsigned requests remain 401 outside local/test exceptions.

**Verify**:
the webhook test command exits 0.

### Step 8: Register and track the two scheduled jobs

Add two Payload tasks in `src/payload.config.ts`, both with
`redwoodSessionConcurrency` and `REDWOOD_TASK_RETRIES`:

1. `redwood-sync-upcoming-schedule-blocks`
   - schedule: `process.env.REDWOOD_UPCOMING_SCHEDULE_CRON || '0 11 * * 1'`
   - queue: `redwood`
   - default is Monday at 11:00 UTC (6:00 EST / 7:00 EDT).
2. `redwood-materialize-todays-collections`
   - schedule: `process.env.REDWOOD_TODAY_SCHEDULE_CRON || '0 10 * * *'`
   - queue: `redwood`
   - default is daily at 10:00 UTC (5:00 EST / 6:00 EDT).

Use UTC defaults deliberately so container timezone/DST does not silently
change the cron interpretation. The one-hour seasonal shift remains within the
requested morning window.

Each handler must:

- record running/completed/failed states through the existing Job Runs helpers;
- return only counts/status, never donor data;
- include a concise summary;
- throw retryable integration failures so Payload retries them;
- use `manual-review` for ambiguous data and partial replacement states.

Add both slugs/labels and summary cases to `JOB_TASK_LABELS` and its tests.

The continuously polling `worker:redwood` remains unchanged. Ensure production
also runs `worker:redwood:schedules` as a second service/process. Add a
`worker-redwood-schedules` service to `docker-compose.yml` using the existing
worker image/target and command override; it must not mount or expose secrets
differently from `worker-redwood`.

**Verify**:

- generated Payload task types contain both slugs;
- Job Runs unit tests pass;
- `pnpm validate:production-env` passes.

### Step 9: Add configuration, safe defaults, and operator documentation

Add these runtime variables to `.env.example` and
`env/production.env.example`:

```dotenv
REDWOOD_SCHEDULE_AUTOMATION_ENABLED=false
REDWOOD_UPCOMING_SCHEDULE_URL=https://toxaccess.redwoodtoxicology.com/Pages/User/UpcomingScheduleCollection.aspx
REDWOOD_SCHEDULED_COLLECTIONS_URL=https://toxaccess.redwoodtoxicology.com/Pages/User/ScheduledCollections.aspx
REDWOOD_CALCOM_EVENT_TYPE_ID=
REDWOOD_CALCOM_ATTENDEE_EMAIL=
REDWOOD_UPCOMING_SCHEDULE_CRON=0 11 * * 1
REDWOOD_TODAY_SCHEDULE_CRON=0 10 * * *
REDWOOD_SCHEDULE_HANDLER_CRON=0 * * * * *
```

Keep them runtime-only. Do not add them as Docker build secrets.

Document one-time Cal.com setup:

- create one private `ToxAccess Hold` event type with a 10-minute duration;
- leave it on the default Cal.com availability schedule so regular hours and
  date overrides remain managed only in Cal.com;
- set its destination to the intended Google Calendar;
- disable attendee reminders/workflows and video-meeting creation;
- use the internal attendee mailbox configured above;
- verify the Google calendar is also selected for Cal.com conflict checking;
- record the event type ID in Dokploy;
- run one supervised non-production hold→real booking→cancel rehearsal before
  enabling the kill switch.

Document operations:

- Monday hold creation;
- daily materialization;
- how to identify a reservation by schedule ID without exposing donor data;
- manual-review states;
- recovery when actual booking exists but the hold remains;
- ToxAccess active-session conflict;
- scheduler and worker health checks;
- how to disable only schedule automation without disabling client provisioning.

**Verify**:
`pnpm validate:production-env` exits 0 and no new runtime-only value is mounted
as a build secret.

### Step 10: Run the full verification and a supervised rehearsal

Run the focused tests, integration suite, typecheck, lint, and env validation
from "Commands you will need."

Then, with explicit operator supervision and non-donor test data:

1. Fetch one controlled upcoming block.
2. Confirm one private hold appears in the intended Google Calendar.
3. Re-run Monday sync; confirm no second hold appears.
4. Feed a sanitized/controlled day-of donor selection.
5. Confirm the real Cal.com booking is created before the hold is cancelled.
6. Confirm exactly one real `bookings` row exists with the Redwood schedule ID.
7. Confirm that booking appears in Today’s Schedule when its start is today.
8. Re-run materialization; confirm no duplicate Cal.com, Google, or Payload
   record appears.
9. Confirm no donor notification was sent and no placeholder booking appeared
   in Today’s Schedule.

Only after all checks pass should
`REDWOOD_SCHEDULE_AUTOMATION_ENABLED=true` be enabled in production.

## Test plan

- Parser fixtures and tests:
  `src/lib/redwood/__tests__/schedule-pages.test.ts`.
- Orchestration/idempotency tests with mocked ToxAccess, Cal.com, and Payload:
  `src/lib/redwood/__tests__/schedule-sync.test.ts`.
- Cal.com HTTP contract tests with mocked `fetch`:
  `src/utilities/__tests__/calcom-api.test.ts`.
- Signed webhook metadata and normal-webhook regression tests:
  existing `calcomWebhook.test.ts` and `calcomRoute.test.ts`.
- Job history label/summary tests:
  `src/lib/jobs/__tests__/jobRuns.test.ts`.
- Existing guided schedule and payment tests remain green.
- Do not use real donor information in fixtures, snapshots, logs, or test names.

## Done criteria

- [ ] Monday task creates one idempotent Cal.com hold per ToxAccess aggregate
      count in consecutive 10-minute blocks beginning at the rounded opening of
      the applicable Cal.com schedule/override, regardless of other bookings.
- [ ] The Cal.com hold creates a busy event in the intended connected Google
      Calendar.
- [ ] Placeholder webhooks never create `bookings` rows.
- [ ] Day-of task creates/reuses one real Cal.com booking using the verified
      day-of join.
- [ ] The real booking is durable before the placeholder is cancelled.
- [ ] Signed webhook writes exactly one ToxAccess-sourced `Booking` and links a
      unique client by Redwood donor ID when possible.
- [ ] The real booking appears in Today’s Schedule with no new schedule UI.
- [ ] Re-running either task creates no duplicates.
- [ ] Parser drift and ambiguous matches fail closed and preserve existing
      calendar reservations.
- [ ] Missing rows in the rolling two-week view are not auto-cancelled.
- [ ] ToxAccess/Cal.com credentials, cookies, raw HTML, and donor details are
      absent from logs/job summaries.
- [ ] Both the continuous worker and schedule-handler process are documented
      and deployable.
- [ ] Focused tests, integration tests, typecheck, lint, and production-env
      validation all pass.
- [ ] `plans/README.md` status is updated.

## STOP conditions

Stop and report; do not improvise if:

- The populated day-of page lacks a stable ID or an unambiguous combination of
  date, gender, and occurrence that can match a derived upcoming reservation.
- The dedicated hold event type is not tied to the intended Cal.com schedule.
- No recurring availability or date override applies to a ToxAccess date.
- The configured availability window is too short for all required consecutive
  10-minute blocks.
- A supervised test shows `allowConflicts` or `skipBookingLimits` is ignored
  because the API credential is not recognized as an event-type host.
- The day-of page cannot provide a donor ID and name.
- A page returns neither the verified table nor the verified empty-state marker.
- Inspecting the page requires closing an operator's active ToxAccess session,
  solving a CAPTCHA, or bypassing an access control.
- The Cal.com account is not connected to the required Google destination
  calendar.
- The private Cal.com event type cannot suppress donor-facing notifications or
  cannot create the out-of-bounds/conflicting replacement flow.
- Cal.com does not round-trip the metadata required for idempotency and webhook
  filtering.
- A test would require real donor PII or a real production calendar mutation.
- The implementation needs to alter payment/refund/sample-collection behavior.
- A second failure after a reasonable fix indicates external API behavior
  differs from the verified contract.

If the Cal.com destination-calendar or metadata assumptions fail, stop and
return with evidence. The fallback is a direct Google Calendar API integration
with a deterministic caller-supplied event ID, but that is intentionally not
authorized by this plan because it adds Google OAuth/service-account setup and
a second synchronization path.

## Maintenance notes

- Treat authenticated ToxAccess HTML as an external API contract. A zero-row
  result is safe only when the known empty-state marker is present.
- The two-week page is rolling. Never infer cancellation from a row aging out of
  the visible window.
- Create replacement before cancellation. This makes partial failure leave
  duplicate blocked time temporarily rather than accidentally exposing an open
  slot.
- Keep Cal.com metadata PII-minimal: derived reservation key, verified day-of
  identity, and donor ID only; never include DOB, email, phone, credentials, or
  raw HTML.
- Reviewers should scrutinize every external mutation for idempotency and every
  log/error for donor data.
- A dedicated ToxAccess automation username is strongly preferred because the
  site disallows concurrent sessions. If one cannot be provisioned, schedule
  early and document the expected operator-session failure/retry behavior.
- If ToxAccess later exposes an official scheduling API/export, replace only
  `schedule-pages.ts`; keep the reservation/materialization state machine and
  its tests.
