# Redwood / ToxAccess Automation Runbook

## Runtime requirements

- Set `REDWOOD_AUTOMATION_ENABLED=true` only after the dedicated worker and credentials are deployed.
- Run `pnpm worker:redwood` continuously. It keeps one Payload process alive, checks an idle queue every
  `REDWOOD_WORKER_POLL_MS` milliseconds (one second by default), and drains follow-up work immediately after a job
  succeeds. The same process calls Payload’s schedule handler before each queue drain, so recurring random-testing
  jobs do not require another worker or container. This avoids repeated Payload startup work and removes an extra
  polling delay between donor creation and the required default-test sync. The guided workflow normally reports
  donor readiness within 1–20 seconds when direct HTTP succeeds.
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
- `GOOGLE_CALENDAR_ORGANIZER_EMAIL` is an optional Today’s Schedule fallback when Cal.com omits its host email. `GOOGLE_CALENDAR_IMPERSONATED_USER` is only for an intentionally configured Google Workspace domain-wide delegation setup.
- Keep `RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=false` until the credentials have been verified. Cal.com schedule `RANDOM_TESTING_CALCOM_SCHEDULE_ID=840279` remains the source for normal and date-specific availability. Event type `RANDOM_TESTING_CALCOM_EVENT_TYPE_ID=3684719` is the unpaid, 10-minute `midrugtest/drug-test` booking created after ToxAccess identifies the donor.
- The Monday job creates private, busy Google Calendar holds with no attendees and no reminders. Hidden extended properties make the job idempotent.
- The daily job creates the donor’s unpaid Cal.com booking with conflicts allowed, writes or updates the linked Payload booking for **Today’s Schedule**, and only then deletes the anonymous Google Calendar hold. Cal.com’s existing Google Calendar integration supplies the named appointment; its event-type workflows control any attendee notifications.

### Staged production rollout

1. Deploy the website and the single `pnpm worker:redwood` process with `RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=false`.
2. Open the Payload admin dashboard’s **Random Testing Sync** widget and run **Check Connections**. This signs in to ToxAccess, verifies that Cal.com event `3684719` is unpaid, 10 minutes, and attached to schedule `840279`, and reads the shared Google calendar without changing external data.
3. Run **Preview Today** to verify the ToxAccess donor IDs match the expected website clients. Preview remains read-only even while the calendar-write kill switch is disabled.
4. Set `RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true`, redeploy/restart the website and worker, and run **Check Connections** again.
5. Use **Queue Upcoming Holds** once. The button queues the same task used by Monday cron; its result appears in **Active Jobs** and **Job History**. Verify the expected private holds in Google Calendar.
6. Use **Queue Today’s Sync** only when today’s preview is correct. Verify the unpaid Cal.com appointment, its named Google Calendar event, the removed anonymous hold, and the client in **Today’s Schedule**.

Manual queue buttons require a super-admin, refuse to run before the in-session connection check passes, and deduplicate an already queued or running sync. Scheduled jobs remain governed by the server-side kill switch.

## Guided collection behavior

- The ToxAccess step polls verified donor/default-test/headshot status every second while work is active.
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
