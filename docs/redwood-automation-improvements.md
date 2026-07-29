# Redwood / ToxAccess Automation Runbook

## Runtime requirements

- Set `REDWOOD_AUTOMATION_ENABLED=true` only after the dedicated worker and credentials are deployed.
- Run `pnpm worker:redwood` continuously. It keeps one Payload process alive, checks an idle queue every
  `REDWOOD_WORKER_POLL_MS` milliseconds (one second by default), and drains follow-up work immediately after a job
  succeeds. This avoids repeated Payload startup work and removes an extra polling delay between donor creation and
  the required default-test sync. The guided workflow normally reports donor readiness within 1–20 seconds when
  direct HTTP succeeds.
- Run `pnpm worker:redwood:schedules` when nightly repair sweeps are enabled.
- Keep Redwood credentials server-only. Never expose them through client props, logs, or admin alert context.
- Keep `REDWOOD_ACCOUNT_NUMBER` in `REDWOOD_ALLOWED_ACCOUNT_NUMBERS`; mutations fail closed for other accounts.

## Automatic behavior

- Every active client creation queues one idempotent `redwood-import-client` job from the Clients collection hook. Frontend, guided/admin registration, and direct Payload admin creation use the same launch path.
- Import searches active and inactive donors by name and DOB across every allowed ToxAccess account before creating. It records the assigned donor ID, actual account, and call-in code after verification.
- Required lab defaults queue after donor verification. Instant-only clients are skipped; a lab test without a ToxAccess code requires manual review.
- Admin headshot changes queue behind an in-progress donor import or upload immediately for an existing donor.
- Redwood-backed identity edits require the admin save decision. Client/self-service and trusted workflow edits queue automatically, and all paths remain durable pending fields until the update job verifies them.
- Marking a client inactive queues donor inactivation. Marking the client active again queues the idempotent import/match path, which reactivates an inactive donor.

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
