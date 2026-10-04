# Workflow regression tests

The required PR checks run the full Vitest suite and all Playwright workflows.
The GitHub check is still named `ui-smoke` to preserve branch protection, but it
runs the complete browser suite, including the Safari PDF regression. A smoke
tag remains available for quick local feedback.

| Command                    | Coverage                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:integration:ci` | Full Vitest suite, including PDF parsing, validation, access, result classification, billing, and payment safeguards |
| `pnpm test:e2e`            | All browser workflows in Chromium plus the Safari PDF regression                                                     |
| `pnpm test:e2e:smoke`      | Tagged registration, collection, result-decision, and payment regressions in Chromium                                |
| `pnpm test:e2e:workflows`  | All workflows in Chromium                                                                                            |
| `pnpm test:gate`           | Full integration and browser suites                                                                                  |

## What the browser tests protect

| Workflow                      | Behavioral checks                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend registration         | Required fields, DOB, supported gender choices, self/court/employer recipients, new referrals, medications, successful registration/sign-in and admin email delivery                         |
| Admin registration            | Step validation, recipient persistence, shared phone numbers, and saving the new client's headshot                                                                                           |
| Guided instant collection     | Schedule/client selection, prepaid/owed/referral payments, credit/undo, report identity acknowledgement and replacement, medication/results review, completed test and booking linkage       |
| Guided lab collection         | Manual report-created gate, Back/Reset behavior, unpaid continuation, completed collection and booking/payment linkage                                                                       |
| Standalone instant collection | PDF upload, validation, client-registration detour, Back/refresh behavior, result decisions, saved test and report email attachments                                                         |
| Standalone lab collection     | Client/date/breathalyzer validation, editing and headshot cropping, saved collection and recipient delivery                                                                                  |
| Lab screening                 | Matching a pending collection, missing-decision/empty-confirmation validation, retained edits, saved results and report attachments                                                          |
| Lab confirmation              | Matching a pending test, required confirmation results, saved analytes, preserved unpaid balance and report attachments                                                                      |
| Result decisions              | Persisting accept/request-confirmation/pending-decision for unexpected positives in both instant and lab flows                                                                               |
| Staff/account payments        | Native navigation/edit access, denied deletion, per-test self-pay and unpaid continuation, real-database concurrency/rollback, and recovery after a lost response without duplicate payments |

## Running safely

Use a dedicated local test database and Mailpit. Tests create real synthetic
clients, bookings, payments, and reports, then clean up their own records. A
MongoDB replica set with transactions enabled is required for account-payment
rollback tests. CI starts its own single-node replica set and Mailpit.

Set `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, and the SMTP
variables for that isolated environment. For recipient/attachment checks, set
`NEXT_PUBLIC_IS_LIVE=true`, `EMAIL_TEST_MODE=false`, `EMAIL_HOST=127.0.0.1`,
`EMAIL_PORT=1025`, and `E2E_ENABLE_MAILPIT_ASSERTIONS=true`; the live flag prevents
recipient redirection, so only use this combination with the local SMTP sink.
Disable admin auto-login and external storage/payment/calendar integrations.
Playwright always disables Redwood/ToxAccess automation. Actual external
transactions and ToxAccess report creation are not exercised by these tests.

By default Playwright starts its own app and refuses to reuse a running server.
Set `PLAYWRIGHT_BASE_URL` only for an app already configured for the isolated test
environment. Committed PDF fixtures work without developer-specific file paths;
missing required reports cause a failure.

## Keeping tests resilient

Assert workflow routes, accessible controls, validation state, saved database
values, permission boundaries, recipient delivery, and attachments. Use stable
test IDs for record selection and workflow navigation where captions can change.
Wait for observable state with Playwright assertions; do not use fixed sleeps,
CSS class/color checks, exact font sizes, or pixel-perfect spacing. Responsive
tests retain functional checks for visible/tappable controls, viewport fit, and
the required side-by-side report actions on portrait tablets.

Keep independent tests independent; do not skip a result-decision branch merely
because it did not appear. Seed the data needed to force that branch. Re-run new
critical regressions with `--repeat-each=5` before considering them stable.
