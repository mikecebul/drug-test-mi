# Plan 007: Allow client-paid exceptions for invoice-enabled referrals

Status: **IN PROGRESS — implementation approved by the user on October 3, 2026.** Priority P1; effort L; backend risk high. Planned at `54f5d58`, October 3, 2026. Can be developed independently of the visual changes in Plan 006.

## Business contract

A court/employer accepting referral invoices does not guarantee it pays for every test. At collection, the technician must be able to turn **Bill this referral — for this test only** off so the client pays that test. Staff decide eligibility manually. Turning it off must not change the referral profile, other appointments, recipients, prior invoices or other tests. An unpaid client-pay exception must also stay excluded from referral invoices and remain payable in the test tracker.

Proposal for initial behavior: new unpaid collections for invoice-enabled referrals default to referral responsibility, preserving current behavior. Non-billable/self referrals use client responsibility. Previously prepaid or explicitly assigned bookings preserve their recorded responsibility; do not silently convert settled client money into referral debt. Turning the switch off shows client payment, not a policy determination. The server must validate referral eligibility and persist the chosen payer.

## Why a UI switch alone fails

```ts
// complete-workflow/actions.ts:1504 (cash/credit)
if (referral?.isBillable && (input.amountReceived > 0 || creditApplied > 0))
  throw new Error('This referral pays for the test. Record its payment on the referral invoice.')

// complete-workflow/actions.ts:1780 (Terminal)
if (referral?.isBillable) return { success: false, error: 'This referral pays for the test. Record its payment on the referral invoice.' }
```

`src/lib/referral-invoices/payer.ts:10` resolves payer from the client's current court/employer `isBillable`. `eligibleItems()` in `src/lib/referral-invoices.ts:76` gathers that referral's clients, then their unpaid tests before a cutoff, without a per-test client-pay filter. `src/views/DrugTestTracker/actions.ts:209` and `:359` also reject client payment using the profile-derived payer. Tracker list loaders cache payer by client, so two tests for one client cannot presently show different payer responsibilities.

The guided previous-balance query and `applyIncomingPayment()` / `applyAvailableClientCredit()` exclude invoiced tests, but not a referral-owned test that has not yet been invoiced. Simply bypassing the referral guard could allocate client money to the wrong party's old debt. The payer change must reach invoice eligibility, payment allocation and tracker behavior together.

## Proposed data contract for review

Add an additive billing-responsibility snapshot on **Bookings** and **DrugTests**, separate from payment status/method:

- `billingResponsibility.payer`: `client` or `referral`.
- `billingResponsibility.referral`: court/employer relationship only when payer is referral.
- Server-controlled changed-at/by information if needed to audit the choice.

Names are proposed until schema review; use one canonical resolver throughout. The booking carries the selected responsibility during collection. The test copies a validated snapshot from its linked booking, including the specific referral identity. Client-paid tests remain client-paid if the client later changes referrals. Referral-paid tests remain owed to their recorded referral. Payment status remains paid/partial/unpaid/invoiced according to existing semantics; referral billing is not prepayment.

Legacy records without a snapshot retain today's profile-derived behavior as a compatibility fallback. Do not mass-reclassify historical tests or rewrite sent/paid invoice items in the initial rollout. All newly created tests, including supported standalone/admin creation paths, must resolve an explicit snapshot on the server so the exception cannot disappear during creation. Already invoiced/settled tests cannot be reassigned by flipping a collection switch; use a separate audited correction flow.

## Scope

Expected production files/areas (confirm exact call graph before editing):

- `src/collections/Bookings/index.ts`, `src/collections/DrugTests/index.ts`: additive fields; `src/payload-types.ts` generated from config.
- `src/lib/referral-invoices/payer.ts`: shared booking/test resolver and legacy fallback; its tests.
- `src/lib/referral-invoices.ts`: invoice eligibility by snapshot, including snapshot referral identity; `src/lib/referral-invoices.test.ts`.
- `src/views/DrugTestWizard/workflows/complete-workflow/actions.ts`, `guided-workflow-api.ts`, `Workflow.tsx`: booking response, authenticated payer mutation and visible switch.
- `src/app/(payload)/api/guided-workflow/route.ts`: existing API dispatch; retain its current authentication/session pattern when adding the payer mutation.
- `src/views/DrugTestWizard/workflows/paymentSnapshot.ts` and tests: copy booking responsibility without allowing arbitrary client-provided ownership.
- Instant/lab creation actions: `instant-test/actions/createDrugTestWithEmailReview.ts`, `collect-lab/actions/createCollectionWithEmailReview.ts`; thread validated responsibility into persisted test. Their classification, medication and email logic stays unchanged.
- `src/collections/Payments/services/applyPayment.ts`, `stripeTerminal.ts` and tests: client-debt eligibility, consistent credit/Terminal completion allocation. Preserve allocation order, cents handling, transaction req and idempotency.
- `src/views/DrugTestTracker/actions.ts`, `src/views/DrugTestTracker.tsx`, related tracker types/tests: compute payer per test, not once per client; allow exception follow-up payment and links while retaining invoice locks.
- New meaningful unit/integration/E2E regression tests for this contract.

Out of scope: changing `Courts`/`Employers.isBillable`, Stripe invoice sending/settlement mechanics, sent/paid invoice history, automated referral policy detection, global credit reallocation, confirmation pricing, Redwood/Cal.com integration changes, recipient defaults, registration terms, or deletion of old workflows. If another production consumer relies on global payer inference, inventory it and amend the reviewed scope before implementing.

## Commands and verification baseline

Run drift check first: `git diff --stat 54f5d58..HEAD -- src/collections/Bookings src/collections/DrugTests src/collections/Payments src/lib/referral-invoices.ts src/lib/referral-invoices src/views/DrugTestWizard src/views/DrugTestTracker src/views/DrugTestTracker.tsx src/app`.

The review's six-suite command in `plans/guided-collection-review/README.md` passed 51 tests. Run types with `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`; unit suite with `node node_modules/vitest/vitest.mjs run`; lint with `pnpm lint`; generated Payload types with `pnpm generate:types`; guided E2E with `pnpm exec playwright test tests/e2e/wizard-guided-schedule.spec.ts --project=chromium`; full repository gate with `pnpm test:gate`. Each must exit 0 before merge. Type generation is needed only during implementation, not this review. Build runs migrations and requires local services; do not use it against production as a verification shortcut.

Read the Payload skill if available. Preserve authenticated server boundaries and thread the transaction `req` through nested Payload operations; do not rely on Local API's default access bypass as staff authorization. E2E uses local MongoDB/Mailpit and disables Redwood automation. Do not send real invoices or charges during tests. Model payment tests on `applyPayment.test.ts` and `stripeTerminal.test.ts`, and invoice tests on `referral-invoices.test.ts`.

## Ordered steps

1. **Inventory and characterize.** Run `rg -n 'isClientBilledToReferral|isBillable|billedToReferral|referralInvoice' src`. Read each payer consumer. Add failing contract cases for one client with both referral-pay and client-pay tests, including an unpaid exception. Verify focused resolver/invoice/allocation tests reproduce the current limitation.
2. **Add snapshot and resolver with legacy fallback.** Distinguish referral eligibility from test responsibility. Validate relation type/referral existence and enabled invoicing on the server. Capture responsibility for new bookings/tests while keeping missing snapshots backward-compatible. Generate types, run types and resolver tests. Do not backfill history in this step.
3. **Persist booking choice before payment.** Add an authenticated, test-scoped mutation. Read the latest booking/server referral; reject stale changes that conflict with collected, invoiced, paid or active Terminal state. Do not rely on a browser boolean for final billing. Return canonical updated context and revalidate. Preserve choice on Back/refresh. Verify server tests for eligible/ineligible referrals, tampering, concurrent/stale state and both switch directions before a payment.
4. **Honor responsibility in all payment paths.** Resolve booking payer for cash, credit and Terminal start/completion. Query/display/allocate only client-owned unpaid balances, including legacy resolution; exclude referral debt before invoice creation as well as after. Keep oldest-first among eligible client balances, current-booking reservation and excess-to-credit behavior. Use cents and transaction/idempotency tests. The switch must be locked during an active payment; a race cannot charge one payer and invoice another.
5. **Copy responsibility into created tests and invoice selection.** Reuse the existing creation actions and payment snapshot boundary; final submit rereads the booking. Exclude client-pay exceptions from referral invoice preview, creation and replacement even if unpaid/partial or confirmation fees later create debt. Use the captured referral for explicit referral-pay snapshots. Preserve legacy fallback and existing invoice item locks. Verify tests for instant and lab creation, unpaid/partial/paid exception exclusion, referral changes, and legacy records.
6. **Update follow-up consumers and expose the switch.** Tracker loads, cash/credit payment, confirmation-related payer checks and client payment-link creation resolve per test. Preserve confirmation fee calculations and invoice lock protections. Present ON: Referral will be invoiced; OFF: Client pays for this test. Recipient settings remain unchanged. Verify tracker tests, guided E2E, types/lint and the full test gate.

## Required regression matrix

| Case | Expected |
| --- | --- |
| Billable referral, switch on, unpaid test | No client charge; only the recorded referral can invoice it. |
| Same referral, switch off, full client payment | Cash/card/credit succeeds; test never enters referral invoice. |
| Same referral, switch off, no/partial client payment | Client balance remains in tracker and is payable later; never referral-invoiced. |
| Mixed payer tests for one client, referral debt not yet invoiced | Client money/credit applies only to client debt; referral debt remains untouched. |
| Already invoiced referral debt | Existing locks remain; no double payment or silent reassignment. |
| Client changes referral later | Explicit snapshots retain their payer and referral identity. |
| Legacy test/booking with missing snapshot | Existing behavior retained; no historical rewrite. |
| Prepaid client booking later associated with billable referral | No duplicate charge; no new referral debt for an already paid test. |
| Terminal active, completion retry, duplicate submission | No payer race, duplicate charge, credit application or test. |
| Confirmation fees on a client-pay exception | Fee remains client-owned; classification/pricing logic unchanged. |
| Non-billable/self referral attempts referral payer | Server rejects invalid choice; ordinary client payment still works. |
| Billing switched while email recipients configured | Recipient composition and consent unchanged. |

## Done criteria and STOP conditions

Done requires schema/design approval; generated types current; passing types/lint/unit/full gate; per-test payer displayed consistently in wizard and tracker; verified exclusion from invoice preview/create/replacement for unpaid client-pay exceptions; allocation excludes all referral debt; no historical invoice/credit mutations; reviewed bounded diff and a feature-branch PR with CI.

STOP if the schema/excerpts drift, legacy fallback cannot be defined without a data migration, another consumer would still infer payer globally, a payer change requires moving settled/invoiced funds, a transaction or idempotency boundary would need redesign, or a verification fails twice. Expand the proposal for review instead of bypassing profile checks in one endpoint. Retain the current feature until the entire exception path is tested; do not ship just the switch.

Maintenance: every future test creation/payment/invoice/confirmation consumer must use the canonical resolver. Do not cache responsibility solely by client. Any future reassignment UI needs invoice locks and audited correction semantics; the collection switch cannot serve as a refund tool.
