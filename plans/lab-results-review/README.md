# Unified lab results

Implemented in the combined [PR #95](https://github.com/mikecebul/drug-test-mi/pull/95), which includes and supersedes PR #93. The generated mockups are the visual reference; this is now a production UI implementation on the feature branch.

[Open the original gallery](review.html).

[Latest matching mockup](images/04-match-lab-report-simple.png) — visible report type, avatar headshot action, Change client inside the profile card, only mismatching identity fields, and three collection choices initially. The selected collection is pinned first; alternatives sort by client name and then oldest date, with the rest available through Show more.

## Four screens

1. **Upload** — one Lab results option for screening, confirmation and combined PDFs. Extraction runs on this screen. Unsupported or failed extraction cannot advance. Report type is detected from the PDF.
2. **Match** — visible report-type override beside the report viewer and replacement, compact client headshot/DOB/Edit/Change client, three eligible collection choices initially and expandable alternatives. The selected collection is pinned first; others sort by client name and then oldest date. Only differing identity fields are compared, with acknowledgement still required. The empty avatar opens headshot capture. Completed collections and incompatible stages are excluded. Client search can narrow the collection list. Strong unique matches can be suggested; ambiguous matches require selection.
3. **Results** — one compact result strip with medication expectations from the collection-time snapshot. Screening uses the existing decision choices and collapsed test edits. Confirmation uses a substance/status/measurement table with expandable analytes and a small correction dialog. Multiple analytes are shown as a count, never as one class-wide concentration. Unknown results start blank and block final delivery until reviewed; adding a result never defaults to negative. Combined reports use the selected record's stage: a first report updates the collected screening record; a later confirmation retains its original screen and specimen validity.
4. **Review** — compact client/result context, one recipient card, PDF viewer and separate client/referral email previews. No duplicate confirmation-summary step or payment step is added. Existing opt-out, recipient editing, unpaid confirmation balances and attachment behavior remain.

The old screening and confirmation URLs are aliases into this same flow, not separate user-facing interfaces. Back preserves edits within the same report/collection. Report replacement, client/collection changes and Reset clear report-derived data and invalidate identity acknowledgement. Same-metadata replacement PDFs cannot inherit another file's extraction cache.

Payload's native navigation remains in place. Client IDs are not displayed. Medications are text, not pictures. Green means a clear/expected result, amber means a warning, inconclusive or unresolved result, and red means an unexpected result. Loading, failed, incomplete or unread screening data is not presented as negative. Confirmation status is derived with the existing final-status service.

Guided collection and lab entry share a configurable progress renderer with their own step keys and labels. PDF actions sit below the filename beside a small report-type selector. The empty avatar has hover/focus feedback, and identity verification stays inside the comparison panel. Collection choices always show the client name, a readable timestamp in the clinic timezone without seconds, and plain status text.

## Save safeguards

The unified submit action authenticates an admin and rechecks the selected record's stage before delegating to the established screening/confirmation save actions. Those actions read the actual uploaded bytes through the shared PDF.js parser and verify identity acknowledgement against the current client, before uploads, writes or emails. Originally requested confirmations and previously received results are retained; every required result must be resolved before final delivery. Missing results leave the existing record pending.

Classification, payer, ledger, confirmation-payment and notification services are reused. No automatic upload, webhook, donor merge or OCR is added. Source rectangles remain available for a future highlighting viewer.

## Parser and verification

All report types use `parseDrugTestReport`; compatibility names forward to the same reader/region engine. The parser separates screen/confirmation completeness, retains detailed analytes, reconciles qualitative and quantitative summaries with table outcomes, checks printed cutoffs, and flags unknown/contradictory data. [Parser contract](../../docs/pdf-report-parsing.md).

Tests validate the actual four-screen flow, all detected report branches, identity review, source replacement, correction retention, preserved historical screen/medications, request coverage, unpaid balances, saved records, recipients and PDF attachments. Required CI stays eight essential Chromium smoke cases; the expanded workflow, portrait and repeated safety coverage remain local. Current counts and results are recorded in PR #95.

The six available real reports are audited outside the repository with aggregate-only output. Production report content is not committed. The original generated images use fictional clients; prompts and references are in [prompts.json](prompts.json).
