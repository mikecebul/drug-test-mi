# Drug test workflows

`DrugTestWizardClient.tsx` selects a workflow. Its `step` URL parameter is the navigation source of truth. Each workflow owns its TanStack form; only the active `form.FormGroup` validates when Next is pressed. Standalone editors use `useAppForm`, a shared Zod schema, and shadcn `Field`/`FieldError` controls.

## Where changes belong

| Concern                                                   | Owner                                     |
| --------------------------------------------------------- | ----------------------------------------- |
| Guided booking, payer, payment, preparation               | `workflows/complete-workflow/`            |
| Collection details and staged date/time editor            | `workflows/collect-lab/`                  |
| PDF upload → match → results → review                     | `workflows/lab-results/`                  |
| Report parsing and assay interpretation                   | `src/utilities/extractors/`               |
| Confirmation decisions, fees, checkout lifecycle          | `src/collections/DrugTests/confirmation/` |
| Ledger allocation, credit, reversal, transaction boundary | `src/collections/Payments/services/`      |
| Saved test presentation and payment history               | `src/collections/DrugTests/views/`        |
| Shared result and payment email layouts                   | `src/emails/`                             |

## Server entry points

`actions.ts` is a compatibility facade for focused modules in `actions/`: extraction, classification, previews, inline registration, and the older screening save. Unused duplicate saves are removed. Every callable action authenticates independently with `server/requireWizardAdmin.ts`; calling it from another action does not replace that check. Client and unauthenticated users cannot invoke clinic operations.

The lab-results final save delegates to the screening or confirmation action. Those actions read the actual PDF bytes and verify identity; confirmation reconciliation retains earlier received outcomes and requires every requested/report substance. Combined reports use the final-result template in both preview and delivery. Confirmation previews use the medication and PBT snapshot stored on the test, not current medications.

Matching loads all eligible pages before ranking. New screens require a collected lab test; lab confirmation reports can also finish an instant test's confirmation request. Changing the file, report type, or collection clears its dependent review state.

## Money and clinical history

Changing a confirmation decision must go through `prepareConfirmation`, including from the saved Summary view. It recalculates charges, protects paid requests, closes stale checkouts, preserves the first screening date, and enforces the hold. A decision edit does not spend credit. Explicit credit, cash posting, payment reversal, and Stripe fulfillment require a database transaction; unpaid decisions can use the standalone-safe versioned update.

Keep historical screening findings and medication snapshots separate from confirmation outcomes. Unknown or conflicting confirmation results are unresolved, and duplicate results cannot satisfy a missing substance. Append notification history when updating a saved test.

## Verification

Run `pnpm test:integration:ci`, `pnpm exec tsc --noEmit`, and `pnpm lint`. CI also runs the Chromium workflow suite against its disposable replica set and Mailpit. Use only synthetic fixtures in an isolated `drug-test-mi` verification database for browser tests. Never point fixture cleanup at the development database or start a production automation worker for UI verification.
