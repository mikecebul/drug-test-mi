# Plan 006: Make guided collection recoverable and clear

Status: **IMPLEMENTED — approved October 3, completed on the feature branch October 4, 2026.** Priority P1; effort M; frontend risk medium. Planned at commit `54f5d58`, October 3, 2026. No backend change is part of this plan.

## Purpose and current state

Staff use the guided scheduled/walk-in flow to collect tests. It hands off to the old instant and lab components. When staff reach upload before generating the ToxAccess PDF, Back currently returns to schedule and drops the booking, requiring repeated setup. Prepaid clients see a generic payment-entry screen. Extraction values use oversized text. The user requested analysis and generated screen concepts before any source changes.

Current load-bearing excerpts:

```tsx
// src/views/DrugTestWizard/DrugTestWizardClient.tsx:76
if (bookingId && (workflow === 'collect-lab' || workflow === 'instant-test' || workflow === '17-panel-instant')) {
  resetGuidedScheduleCache(queryClient)
  setStates({ workflow: 'guided', step: 'schedule', clientId: null,
    bookingId: null, returnTo: null, testType: null })
  return
}
```

```tsx
// src/views/DrugTestWizard/workflows/complete-workflow/Workflow.tsx:279
const params = new URLSearchParams({ clientId, bookingId, returnTo: 'guided', testType: testType.value })
if (testType.category === 'instant') {
  params.set('workflow', 'instant-test')
  params.set('step', 'upload')
  return `/admin/drug-test-upload?${params.toString()}`
}
params.set('workflow', 'collect-lab')
params.set('step', 'medications')
```

```tsx
// src/views/DrugTestWizard/workflows/instant-test/steps/Extract.tsx:45
<div className="pl-7 text-2xl font-semibold tracking-tight">{children}</div>
```

Read `src/views/DrugTestWizard/AGENTS.md` and `docs/forms/contexts.md` before implementing. `step` in nuqs is routing truth; use TanStack FormGroup validation only for the active group, clear stale errors on Back, focus the first invalid field, and keep stable input IDs/names and aria-invalid. Existing `FieldGroupHeader`, shadcn components, theme tokens and Geist are the design conventions. Do not copy new styling from image pixels or change global CardTitle defaults for unrelated screens.

## Scope and boundaries

### Latest design direction — supersedes the expanded mockups

Keep the first review's simple step layouts. The user rejected the expanded collection screens after reviewing them. Use one compact client row with a real headshot, name/DOB, current test and Edit; aim for a 56–64px photo and an 80–96px row at desktop size. Do not duplicate identity elsewhere on the page. The only information repeated across collection steps is this client context and, after extraction, the compact test-result context.

Today contains appointments and collection/booking entry actions; remove the added Follow-up section. Prepare contains client context and the two generate/upload tasks only, without medications, result cards or duplicate client/test facts. Payment retains the first review's simple state layouts and optional credit disclosure. Medication verification is the single step for the active medication list and its edits; do not generate medication images or add medication cards to other steps.

Results use one small strip, not a grid of classification cards: a labeled green/yellow/red status plus one line of expected and detected substances. Green is negative or expected-positive; yellow is a non-critical missing-expected warning or a pending review state; red is unexpected positive, critical missing-expected, mixed unexpected, or a positive BAC override. These labels must come from the existing classification result. A green expected-positive must never be relabeled negative. Report parsing/client-match warnings and inconclusive/dilute/BAC findings remain visible when relevant; show each fact once. No result is inferred before a report exists.

Under the strip, show the existing three decision choices as a simple radio row. Only show this decision when existing rules require it. For requested confirmation, default to all unexpected substances and keep an accessible Change action for the required substance selection. Put optional date, detected-substance, dilute and breathalyzer editing under a collapsed Edit test details disclosure. Expand the affected disclosure and focus its field when validation fails; a required acknowledgement or decision cannot be hidden. Do not silently change validators or the classification rules while simplifying the controls.

The final review repeats the compact identity/result strip, then shows recipients and the report attachment. Remove the repeated full test-details table, medication list and payment recap. Keep the initial screen result separate from a final confirmation result; request-confirmation means final result pending, not a confirmed positive. Show each report link/attachment and each warning once.

Before final submission, the displayed preview must correspond to the current client, report, test type, medication snapshot, detected substances and BAC. Loading/error/stale preview states cannot appear negative or ready. Characterize the existing VerifyData effect that clears decisions when a preview is absent; do not erase a staff decision solely while an asynchronous preview is loading. Server classification and creation checks remain authoritative and unchanged in this plan. If preserving this requires changing backend classification or email semantics, create a separate reviewed proposal.

The client/referral summary designs were liked and retained. Staff navigation uses native Payload groups and the existing beforeNavLinks extension slot; see Plan 008. Do not implement the invented Today/Collections/Results sidebar from the first image batch.

Allowed source areas: `src/views/DrugTestWizard/DrugTestWizardClient.tsx`, `components/main-wizard`, `workflows/complete-workflow/Workflow.tsx`, `RedwoodProvisioningCard.tsx`, existing instant/lab navigation and step components, and one shared collection step-header/context component if useful. Add focused navigation/helper tests and cases to `tests/e2e/wizard-guided-schedule.spec.ts`; existing instant/lab tests may change only to reflect approved labels/routes.

Out of scope: server actions, API request/response contracts, collection schemas, generated Payload types, migrations, test classification, medication persistence, payment allocation/credit/Terminal services, invoicing, registration internal flow, lab screen/confirmation flows, Redwood automation, Cal.com scheduling and existing booking completion statuses. The referral switch is Plan 007; do not add an inert or misleading switch in this PR.

## Commands and baseline

| Purpose | Command | Expected |
| --- | --- | --- |
| Drift | `git diff --stat 54f5d58..HEAD -- src/views/DrugTestWizard tests/e2e/wizard-guided-schedule.spec.ts` | Review any drift against the excerpts before work. |
| Types | `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` | Exit 0. Not run during the design review. |
| Focused baseline | The six-suite Vitest command in `plans/guided-collection-review/README.md` | Currently 6 files / 51 tests pass. |
| Unit suite | `node node_modules/vitest/vitest.mjs run` | All pass. |
| Lint | `pnpm lint` | Exit 0; no new warnings. |
| Guided E2E | `pnpm exec playwright test tests/e2e/wizard-guided-schedule.spec.ts --project=chromium` | All cases pass with local test services. |
| Collection E2E | `pnpm exec playwright test tests/e2e/wizard-instant.spec.ts tests/e2e/wizard-collect-lab.spec.ts --project=chromium` | Pass using local PDF fixtures. |
| PDF browser gate | `pnpm test:e2e:pdf-browser` | Chromium and WebKit pass. |

E2E needs local MongoDB, Mailpit and test fixture envs. `playwright.config.ts` disables external Redwood automation. Do not point tests at production or reuse an unsafe developer server. The review ran only the six mocked unit suites. Avoid `pnpm build` as a casual UI check: it runs Payload migrations. If pnpm hits its private-store sandbox restriction, use the installed executables or request scoped permission; do not install a new package manager.

## Ordered implementation

1. **Characterize the handoff.** Add a regression for a guided instant booking that records payment, enters upload with no PDF, returns to the same booking's ToxAccess setup, then resumes upload. Assert stable booking/client/test IDs, no new payment/credit application and no test created before final submit. Add equivalent lab-entry Back coverage. Use `wizard-guided-schedule.spec.ts:755` and `:798` as patterns. Verify the new cases reproduce the current failure before changing navigation.
2. **Repair entry navigation.** Distinguish Back from leaving the workflow. Guided instant upload and guided lab medications entry return to `workflow=guided&step=toxaccess&bookingId=<same id>`; preserve necessary client/test context and refresh the selected booking. Standalone workflows keep their existing exit behavior; completed workflows still return to schedule. Do not replay payment mutations on mounting or Back. Verify focused routing tests and guided E2E.
3. **Normalize typography and context.** Share page titles around 28–30px, section headings around 18px, body/input values 14–16px; reserve larger numeric type for the principal balance. Reduce extraction `DetailRow`, warning-name values and unqualified CardTitle sizes locally. Add a compact client/test context strip instead of requiring repeated expanded client cards. Keep existing edit/capture/change actions accessible. Required warnings and confirmations remain visible; only optional details collapse. Verify types/lint and manually inspect desktop, portrait iPad, narrow phone and keyboard focus.
4. **Make paid payment states distinct.** Derive the presentation from the existing amount/payment/allocation data. When today's balance and previous client balances are zero, show prepaid/paid confirmation and collapsed Add account credit. If older debt remains, show prepaid status for today plus a separate visible previous-balance obligation. Keep available credit explicit, allocation order unchanged, cash/card/receipt/undo and Terminal pending/failure/cancel behavior intact. Preserve the existing zero-money payment action when continuing; a label change must not omit required booking updates. Verify unit baseline plus E2E for paid, unpaid, partial, credit, overpayment and pending Terminal.
5. **Optionally combine instant preparation and upload as its own reviewed change.** Reuse the existing instant Upload form/FileUploadField with the ToxAccess donor reference/link alongside it. Route only guided instant bookings to this combined entry after payment, eliminating their separate preparation screen. Keep the lab preparation path. Show Waiting for PDF until a file exists; page focus only reveals a reminder. Keep extraction in its existing next group. Never mark the report generated from a click, tab closure, donor readiness, or focus event. Verify missing file, invalid type/size, failed parsing, replacement PDF, name mismatch and manual ToxAccess fallback. Skip this step if combining screens would require an out-of-scope backend change.

Treat phases as grouped progress; do not hardcode a misleading five-step counter. Do not promise full draft/refresh recovery. Existing instant reload resets are deliberate. Back inside a mounted branch preserves its TanStack values; crossing an unmount boundary after entering data needs explicit draft preservation or a reviewed loss warning. The immediate no-PDF recovery can land without introducing cross-workflow draft persistence.

## Regression matrix

- Instant and all five configured lab types; active 17-panel restriction retained.
- Scheduled and walk-in; missing client/test type; registration return; identity mismatch; missing headshot.
- Fully prepaid without older debt; prepaid with older client debt; partial payment; cash; credit application; overpayment; zero-payment acknowledgement; recorded payment undo; Terminal pending/failure/cancel.
- Upload missing/invalid; PDF parser failure; report replacement; donor mismatch acknowledgement reset; no report-ready change on focus or external-tab closure.
- Medication edits/discontinuation still affect result preview; unexpected positives retain accept/request/pending choices and required confirmation substances.
- Lab BAC validation retained; result recipients versus collection-notification recipients retained.
- Back then Next never creates a duplicate payment or test; completed booking remains collected and links the same test.

## Done and STOP conditions

Done requires approved design, passing types/lint/unit/E2E gates, a reviewed source diff limited to the scope, and evidence that payment/test/email payloads are unchanged. `git diff --name-only` must contain no schemas, migrations or server-action files. Record the actual browser checks; image generation is not functional validation.

STOP if the live excerpts drift, navigation requires changing final submission or payment semantics, draft data crosses clients/bookings, a payer switch is needed, external report readiness is assumed, or a verification fails twice after a reasonable repair. Report a separate proposal rather than changing backend behavior in this UI PR.

Use a `codex/` feature branch and PR. Never push main or bypass CI. Commit descriptions should list changes. This review branch can hold the design assets; implementation begins only after the user's review. Maintenance: new test types need the correct branch, progress and Back behavior; new required fields must remain outside optional disclosures.

Implementation: [PR #93](https://github.com/mikecebul/drug-test-mi/pull/93). See [the implementation record](guided-collection-review/implementation-status.md) and the PR for current verification results.
