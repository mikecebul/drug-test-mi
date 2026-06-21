# Redwood Automation Follow-Ups

Redwood sync logic is intentionally present but disconnected from admin auto-run UI for now. Before re-enabling automatic or operator-triggered syncs, tighten the launch path below.

## Current posture

- Keep Redwood job definitions, queue helpers, services, tests, and tracking collections available.
- Do not auto-queue Redwood updates from client save hooks.
- Do not show admin edit-page buttons that queue Redwood sync, headshot sync, or unique ID backfill.
- Keep Redwood credentials as runtime-only server environment variables.

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
