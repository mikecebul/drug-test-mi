# Approved implementation

Approved October 3, 2026. Implemented on `codex/guided-test-collection-review`, based on `origin/main` at `54f5d58`. Review: [PR #93](https://github.com/mikecebul/drug-test-mi/pull/93).

The selected simplified mockups are the implementation reference. Visible client IDs and the completion booking CTA are omitted. Quick Book remains in native navigation and Today. Payload's built-in account/theme controls remain available.

## Implemented

- Compact identity/headshots, consistent titles, instant preparation/upload together, one medication review, simple result decisions, collapsed test edits, compact recipients and completion.
- Lab preparation shares the two-pane report layout. Explicit technician confirmation of creating the collection report is required; donor readiness, tab closure and focus never imply report creation. Back preserves this confirmation for the same booking/client/test and Reset clears it.
- Report identification shows the differing name/DOB fields in a Website client / ToxAccess report comparison. Unknown values require review. Replacement, identity changes and another client invalidate acknowledgement. There is no automatic donor merge or correction.
- Back to payment retains the same booking and recorded payment/undo information. Continuing without new money preserves the recorded operation. A first zero-payment continuation still records its collection state.
- Conditional result-decision fields stay registered with TanStack Form while their controls are hidden. Decision and substance changes revalidate the active FormGroup directly, clearing earlier errors without stranding the technician. All-empty confirmation selections display an inline error.
- Clear prepaid state with optional account credit, per-test referral/client payer choice, client-owned debt allocation and invoice exclusions, server-owned payer snapshots and active card-payment guards.
- Standard admins can switch an unpaid collection to self-pay and continue without payment. Payer writes use an atomic booking version predicate and support standalone MongoDB.
- Native role-aware staff navigation, client/referral Summary tabs and native Edit, full test histories, separate client/referral balances, and standalone cash account payments. Staff deletion stays restricted.

## Verification

- Full unit suite: 131 files, 890 tests passed after consolidating redundant PDF assertions. TypeScript and ESLint passed; no errors. Existing lint warnings remain.
- CI runs eight essential Chromium smoke cases once, with no retries and a ten-minute browser-job limit. All 56 browser cases, WebKit and the 50-execution stability command remain available locally. The PR records the verified browser results and current required-check status separately.
- Required synthetic PDF fixtures cover every supported panel, incomplete/dilute screens, and confirmation outcomes; missing reports fail CI instead of silently returning from tests.
- Browser assertions use active routes, accessible controls, validation state and saved data. Cosmetic color/font/spacing checks and stale full-message matches were removed. The lab-screen decision step revalidates its active FormGroup and keeps conditional fields registered.
- Browser regressions cover portrait/phone layout, report replacement and identity acknowledgement, payment/credit/undo, client registration, actual local-mail delivery and PDF attachment, standard-admin payer switching and unpaid continuation, native editing/no deletion, and lost-response recovery without duplicate payments or bookings.
- Real-database regressions passed for payer concurrency with transactions disabled, active-card protection, rejecting account payments before unsupported writes, transactional payment rollback, and concurrent retry deduplication.
- Verification uses an isolated local database and Mailpit, with external Redwood, S3, Cal.com and payment integrations disabled. Production verification routes email to Mailpit in the temporary checkout; no production mail transport was exercised. Builds invoke Next directly without migrations.

## Operational prerequisite

New account payments require transactional MongoDB (Atlas/replica set with adapter transactions enabled), because credit, test balances and ledger writes must commit together. Unsupported databases reject these payments before writes. Card account payments remain disabled in this initial approved view. No deployment, migration or merge is part of this implementation.
