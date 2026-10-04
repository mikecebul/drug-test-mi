# Approved implementation

Approved October 3, 2026. Branch: `codex/guided-test-collection-review`, based on `origin/main` at `54f5d58`.

Selected simplified mockups are the implementation reference. Visible client IDs and the completion booking CTA are omitted. Quick Book remains in native navigation and Today. Payload's built-in account/theme controls remain available.

## Implemented

- Compact identity/headshots, consistent titles, preparation and report upload together, Back to payment on the same booking, one medication review, simple result decisions, collapsed test edits, compact recipients and completion.
- Clear prepaid state with optional account credit, per-test referral/client payer choice, client-owned debt allocation and invoice exclusions, server-owned payer snapshots and active card-payment guards.
- Native role-aware staff navigation, client/referral Summary tabs and native Edit, full test histories, separate client/referral balances, and standalone cash account payments.
- Standard admins can switch an unpaid collection to self-pay and continue without payment. Payer writes use an atomic booking version predicate; this does not require a replica set. Existing guided payment compatibility is preserved.
- New account payments require transactional MongoDB (Atlas/replica set with adapter transactions enabled), because credit, test balances and ledger writes must commit together. Card account payments remain disabled in this initial approved view.

## Verification checkpoint — October 4, 2026

- Unit suite: 129 files, 885 tests passed.
- ESLint: passed, no errors; existing warning baseline remains.
- Staff regression suite: four tests passed, including standard-admin payer switching/unpaid continuation, native summaries/edit/no-delete, actual payment rollback/concurrent retry deduplication, and lost-response recovery without a duplicate payment or booking.
- TypeScript passed. The atomic payer concurrency test passed with transactions disabled, including active-card protection and rejecting an account payment before any writes. Guided/registration/PDF browser checks remain in progress; the isolated development app encountered HMR database disconnects, so a stable production verification build is underway.
- Tests use an isolated local database, local Mailpit, and disabled Redwood, S3 and external payment integrations.

Preparing a draft review PR. Verification is still in progress; this is not a completion claim.
