# Redwood / ToxAccess Automation Runbook

## Runtime requirements

- Set `REDWOOD_AUTOMATION_ENABLED=true` only after the dedicated worker and credentials are deployed.
- Run one `pnpm worker:redwood` process continuously. It uses Payload’s combined `jobs:run --handle-schedules` mode, so the same worker evaluates recurring schedules and executes queued jobs. The default two-second worker cron normally reports donor readiness within 1–20 seconds when direct HTTP succeeds.
- Keep Redwood credentials server-only. Never expose them through client props, logs, or admin alert context.
- Keep `REDWOOD_ACCOUNT_NUMBER` in `REDWOOD_ALLOWED_ACCOUNT_NUMBERS`; mutations fail closed for other accounts.

## Automatic behavior

- Every active client creation queues one idempotent `redwood-import-client` job from the Clients collection hook. Frontend, guided/admin registration, and direct Payload admin creation use the same launch path.
- Import searches active and inactive donors by name and DOB across every allowed ToxAccess account before creating. It records the assigned donor ID, actual account, and call-in code after verification.
- Required lab defaults queue after donor verification. Instant-only clients are skipped; a lab test without a ToxAccess code requires manual review.
- Admin headshot changes queue behind an in-progress donor import or upload immediately for an existing donor.
- Redwood-backed identity edits require the admin save decision. Client/self-service and trusted workflow edits queue automatically, and all paths remain durable pending fields until the update job verifies them.
- Marking a client inactive queues donor inactivation. Marking the client active again queues the idempotent import/match path, which reactivates an inactive donor.

## Random-testing calendar setup

- Enable the Google Calendar API in a Google Cloud project and create a service account.
- Share the destination Google calendar with the service-account email using **Make changes and see all event details** (the non-owner writer permission that can access private events). Domain-wide delegation is unnecessary for the single-calendar setup.
- Set `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY`. Store the private key with literal `\n` separators when the deployment environment requires a single line.
- Set `GOOGLE_CALENDAR_ORGANIZER_EMAIL` to the MI Drug Test calendar owner. `GOOGLE_CALENDAR_IMPERSONATED_USER` is only for an intentionally configured Google Workspace domain-wide delegation setup.
- Keep `RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=false` until the credentials have been verified. Cal.com remains the source for normal and date-specific availability through `RANDOM_TESTING_CALCOM_SCHEDULE_ID`.
- The Monday job creates private, busy Google Calendar holds with no attendees and no reminders. Hidden extended properties make the job idempotent.
- The daily job updates the matching hold in place with the ToxAccess donor, restores the calendar’s default reminders, and creates the linked Payload booking for Today’s Schedule. No attendee is added to Google Calendar, so no attendee email is generated.

### Staged production rollout

1. Deploy the website and the single `pnpm worker:redwood` process with `RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=false`.
2. Open the Payload admin dashboard’s **Random Testing Sync** widget and run **Check Connections**. This signs in to ToxAccess, reads the configured Cal.com schedule, and reads the shared Google calendar without changing external data.
3. Run **Preview Today** to verify the ToxAccess donor IDs match the expected website clients. Preview remains read-only even while the calendar-write kill switch is disabled.
4. Set `RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true`, redeploy/restart the website and worker, and run **Check Connections** again.
5. Use **Queue Upcoming Holds** once. The button queues the same task used by Monday cron; its result appears in **Active Jobs** and **Job History**. Verify the expected private holds in Google Calendar.
6. Use **Queue Today’s Sync** only when today’s preview is correct. Verify the named Google Calendar event and the client in **Today’s Schedule**.

Manual queue buttons require a super-admin, refuse to run before the in-session connection check passes, and deduplicate an already queued or running sync. Scheduled jobs remain governed by the server-side kill switch.

## Guided collection behavior

- The ToxAccess step polls verified donor/default-test/headshot status every 1.5 seconds while work is active.
- Physical collection remains blocked until the donor ID is verified and while an automatic required default-test sync is still running. A terminal default-test failure becomes a prominent manual warning so the operator can set it in ToxAccess and continue.
- Headshot work is visible but does not block collection after donor/default-test readiness; a later capture still queues automatically.
- Retryable jobs receive three retries (four total attempts). During retries the UI stays in a working state. Exhaustion creates or updates a deduplicated Admin Alert.
- Manual-review and exhausted states show the operator error, an **Open ToxAccess** fallback, and **Retry and verify**. After manual creation, retry uses the same search-first path to link the donor without duplicating it.

## Operator triage

- **Ambiguous match:** compare name, middle initial, DOB, active status, and account in ToxAccess. Correct the donor/client data, then retry verification.
- **Different account:** do not create a duplicate. Leave or move the donor deliberately in ToxAccess, ensure that account is present in `REDWOOD_ALLOWED_ACCOUNT_NUMBERS`, then retry so the website records the donor's actual account.
- **Inactive donor reactivation:** confirm the donor is active and the inactive group was cleared, then retry.
- **Default-test failure:** confirm the client referral/default test maps to a ToxAccess lab code. Instant tests intentionally skip this step.
- **Headshot failure:** collection may continue once donor/default-test readiness is green. Correct and re-save the website headshot to queue another HTTP upload.
- **Worker/auth failure:** verify the worker process, credentials, account allowlist, and network access. Resolve the deduplicated Admin Alert after a successful retry.

## Remaining hardening opportunities

- Add per-mutation dry-run support for production rehearsals.
- Surface filtered job history and alert links directly in the Redwood Sync tab.
- Capture and audit the non-sensitive Redwood agency label returned by the site.
- Add a direct HTTP contract smoke test against a controlled Redwood test account; unit/integration tests must continue to mock external mutations.
