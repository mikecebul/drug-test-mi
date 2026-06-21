# Redwood Automation Follow-Ups

Redwood sync logic is intentionally present but disconnected from admin auto-run UI for now. Before re-enabling automatic or operator-triggered syncs, tighten the launch path below.

## Current posture

- Keep Redwood job definitions, queue helpers, services, tests, and tracking collections available.
- Allow the frontend registration flow to queue the Redwood import job as the first narrow automatic workflow.
- Use testing agency `(310974) MI Drug Test (PM Testers)` while this automation is being trialed.
- Do not auto-queue Redwood updates from client save hooks.
- Do not show admin edit-page buttons that queue Redwood sync, headshot sync, or unique ID backfill.
- Keep Redwood credentials as runtime-only server environment variables.

## Frontend Registration Automation Follow-Ups

- Add a dedicated feature flag for frontend-registration Redwood automation so the first rollout can be enabled separately from future admin sync buttons.
- Add a dry-run mode that records whether the job would match active, reactivate inactive, or create a donor without mutating Redwood.
- Keep instant-test defaults local-only for Redwood for now: Charlevoix County instant testing uses the 17-panel instant test and does not need a ToxAccess/default-test code.
- Show the latest `job-runs` records and related `admin-alerts` from the client Redwood Sync tab, with retry/cancel controls limited to admins.
- Add a short operator runbook for inactive donor reactivation failures, ambiguous name+DOB matches, and default-test sync failures.
- Capture a non-sensitive summary of the Redwood agency name returned by the page so account `310974` can be audited if Redwood renames the agency label.
- Add an integration smoke test around the frontend registration action that asserts the client is created and a `redwood-import-client` job is queued.

## Improve Before Re-Enabling

- Add a single feature flag for Redwood automation visibility and execution, separate from credential presence.
- Reintroduce sync buttons behind that feature flag with role checks, confirmation copy, and clear disabled states.
- Decide whether client save approval should queue immediately or only mark pending drift for an operator sweep.
- Add an explicit scheduling config for nightly sweeps rather than relying on ad hoc worker commands.
- Add idempotency checks around manual queue actions so repeated clicks cannot create confusing job history.
- Surface job history and incident links from the client Redwood Sync tab without exposing local screenshot paths to non-super-admins.
- Add a dry-run mode for each mutation job that records planned field changes without logging into Redwood.
- Add operational runbooks for failed import, ambiguous donor match, default-test sync failure, and headshot mismatch.
- Verify production worker deployment mounts Playwright browser dependencies and shared upload/public storage.
- Add a small smoke test that asserts automation controls are hidden when the feature flag is disabled.
