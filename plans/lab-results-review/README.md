# Unified lab results

Implemented in the combined [PR #95](https://github.com/mikecebul/drug-test-mi/pull/95), which includes and supersedes PR #93. The generated mockups are the visual reference; this is now a production UI implementation on the feature branch.

[Open the original gallery](review.html).

[Latest matching mockup](images/04-match-lab-report-simple.png) — visible report type, avatar headshot action, Change client inside the profile card, only mismatching identity fields, and three collection choices initially. The selected collection is pinned first; alternatives sort by client name and then oldest date, with the rest available through Show more.

## Four screens

1. **Upload** — one Lab results option for screening, confirmation and combined PDFs. Extraction runs on this screen. Unsupported or failed extraction cannot advance. Report type is detected from the PDF.
2. **Match** — visible report-type override beside the report viewer and replacement, compact client headshot/DOB/Edit/Change client, three eligible collection choices initially and expandable alternatives. The selected collection is pinned first; others sort by client name and then oldest date. Only differing identity fields are compared, with acknowledgement still required. The empty avatar opens headshot capture. Completed collections and incompatible stages are excluded. Client search can narrow the collection list. Strong unique matches can be suggested; ambiguous matches require selection.
3. **Results** — individual result rows with green expected detections, red unexpected detections, and medication names from the collection-time snapshot beneath each applicable substance. Screening uses the existing decision choices and collapsed test edits. Confirmation uses a substance/status/measurement table with expandable analytes and a small correction dialog. Multiple analytes are shown as a count, never as one class-wide concentration. Unknown results start blank and block final delivery until reviewed; adding a result never defaults to negative. Combined reports use the selected record's stage: a first report updates the collected screening record; a later confirmation retains its original screen and specimen validity.
4. **Review** — compact client/result context, one recipient card, PDF viewer and separate client/referral email previews. No duplicate confirmation-summary step or payment step is added. Existing opt-out, recipient editing, unpaid confirmation balances and attachment behavior remain.

The old screening and confirmation URLs are aliases into this same flow, not separate user-facing interfaces. Back preserves edits within the same report/collection. Report replacement, client/collection changes and Reset clear report-derived data and invalidate identity acknowledgement. Same-metadata replacement PDFs cannot inherit another file's extraction cache.

Payload's native navigation remains in place. Client IDs are not displayed. Medications are text, not pictures. Green means a clear/expected result, amber means a warning, inconclusive or unresolved result, and red means an unexpected result. Loading, failed, incomplete or unread screening data is not presented as negative. Confirmation status is derived with the existing final-status service.

Guided collection and lab entry share a configurable progress renderer with their own step keys and labels. PDF actions sit below the filename beside a small report-type selector. The empty avatar has hover/focus feedback, and identity verification stays inside the comparison panel. Collection choices always show the client name, a readable timestamp in the clinic timezone without seconds, and plain status text.

## Save safeguards

The unified submit action authenticates an admin and rechecks the selected record's stage before delegating to the established screening/confirmation save actions. Those actions read the actual uploaded bytes through the shared PDF.js parser and verify identity acknowledgement against the current client, before uploads, writes or emails. Originally requested confirmations and previously received results are retained; every required result must be resolved before final delivery. Missing results leave the existing record pending.

Classification, payer, ledger, confirmation-payment and notification services are reused. No automatic upload, lab-order integration, donor merge or OCR is added. Source rectangles remain available for a future highlighting viewer.

## Parser and verification

All report types use `parseDrugTestReport`; compatibility names forward to the same reader/region engine. The parser separates screen/confirmation completeness, retains detailed analytes, reconciles qualitative and quantitative summaries with table outcomes, checks printed cutoffs, and flags unknown/contradictory data. [Parser contract](../../docs/pdf-report-parsing.md).

Tests validate the actual four-screen flow, all detected report branches, identity review, source replacement, correction retention, preserved historical screen/medications, request coverage, unpaid balances, saved records, recipients and PDF attachments. Required CI stays eight essential Chromium smoke cases; the expanded workflow, portrait and repeated safety coverage remain local. Current counts and results are recorded in PR #95.

The six available real reports are audited outside the repository with aggregate-only output. Production report content is not committed. The original generated images use fictional clients; prompts and references are in [prompts.json](prompts.json).

## Confirmation decisions and payments

[Revised decision mockup](images/05-result-decision-payment.png) adds concise reminders and an optional Stripe link, without a payment-waiting line in the form.

Results Next prepares the reviewed decision and optionally emails a payment link, then advances to Review. It does not wait for payment and does not save the report or claim a laboratory order was placed. Final Review still saves and sends the screening report. An unpaid self-pay confirmation remains in the tracker until its fee is funded; referral-billed tests keep their recorded referral payer.

Lab confirmation costs $45 per unique selected substance. The shared tracker preserves its existing $30 instant confirmation price. Confirmation checkout and available credit fund that test's fee directly, leaving unrelated balances alone. General account payments retain their existing allocation order. The ledger records the confirmation contribution so undoing payment restores the gate. Stripe must report a paid session bound to the stored payment, client, test, request, currency, and amount; duplicate webhooks do not post twice. Expired or changed requests cannot authorize a lab request; any settled money retained as credit creates an admin review alert.

The first screening result date starts a 30-day hold. The result date is visible beside the decision when confirmation needs review, and under Edit test details otherwise; it defaults to the date of entry because the current parser does not extract a report's result-release timestamp. Edits, Back/Next, and resends preserve that first date. For legacy records, the earliest screened notification supplies the known date. Records without that evidence need a screening date before a new tracker request. Expired deferred decisions leave active tracking while history and unpaid debt remain available.

When a self-pay fee becomes fully funded, a job is queued in the payment transaction for the recorded super-admin account. The existing `redwood` worker delivers the email and retries failures three times with backoff, then creates an admin alert if delivery remains unsuccessful. It tells staff to review the report and request confirmation in ToxAccess; there is no automatic lab ordering. Delivery state prevents ordinary duplicate webhook/job notifications. As with SMTP email generally, a worker crash after delivery but before recording success can cause a retry to send the message again.

Changing a paid request requires refunding or undoing its payment first. Open links are closed before an unpaid request changes. Referral invoice history stays intact; confirmation increases that test's referral balance and uses the existing invoice replacement/next-invoice process, rather than charging the client.

Tests use a separate database, local Mailpit inbox, and mocked Stripe checkout. New confirmation cases are local critical tests; CI smoke remains eight cases. Live Stripe checkout and production webhook delivery still need verification in Stripe test mode before deployment.

## Lab UI validation follow-up

The lab Results screen now uses the approved per-substance presentation: unexpected detections are red, expected detections are green, and the associated medication appears directly under the substance. Missing expected substances retain their critical or warning state; unverified/loading/failed results cannot appear as a green negative.

Confirmation substances and the Stripe payment-email checkbox sit inside the selected Request confirmation card. The checkbox is checked by default, and its choice survives Back. Referral billing continues to suppress a client payment link. The compact selector removes the extra container and one-substance Select All/Clear controls.

Every lab Next button remains clickable so the active group can report inline validation errors. Invalid identities, unreadable reports, unverified results and incomplete confirmations still prevent advancement and saving. Readiness validation refreshes after async queries settle. Conditional fields stay registered to avoid stale or missing TanStack error metadata. Collapsed edits reveal invalid fields when needed.

Validation covers real workflow outcomes and field error state rather than disabled-button styling. It includes correction through client-profile editing, retained result edits, every report branch, and the financial flow with the default email preference asserted before opting out of real Stripe in the browser test.

[View the implemented portrait screen](verification/lab-results-request-portrait.png), captured with fictional test data.
