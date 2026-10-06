# PDF report parsing

All report parsing uses **PDF.js directly**, through one application entry point:

```ts
const report = await parseDrugTestReport(pdfBuffer)
```

An optional expected family rejects files uploaded to the wrong workflow:

```ts
const report = await parseDrugTestReport(pdfBuffer, 'instant')
```

The application and private-report audit use this same API. `extract15PanelInstant` and `extractLabTest` remain compatibility adapters that delegate to it. They do not read PDFs independently. No `pdf-parse`, `pdf-ts`, `pdf2json`, or `unpdf` dependency/import is present in the application or lockfile.

## One pipeline

1. `pdfText.ts` loads `pdfjs-dist/legacy/build/pdf.mjs` once per process and reads each document once. It keeps text and page/x/y/width/height coordinates, and destroys the PDF loading task after extraction. The existing Node geometry polyfills and static fake-worker import remain necessary for production tracing.
2. `reportLayout.ts` is the shared table-region engine. It finds Drug/Substance, Result, Method and Cutoff/Reference Range headings, supports different column order and separate screening/confirmation column groups, and reconstructs split/wrapped cells. Repeated headers and shifted tables are handled by their own coordinates. Disclaimers and glossaries are excluded from known table regions.
3. The instant and lab format profiles interpret those same rows. Their assay rules differ: CIA screens report qualitative results; lab LC-MS/MS confirmations can include measurements and cutoffs. This is format-specific interpretation within one parsing pipeline.
4. The parser returns the interpreted data and explicit review reasons. It rejects mixed report families, conflicting client/collection identities and ambiguous panel profiles rather than defaulting to an instant test.

Supported headerless reports use a bounded inference path in the same region engine. They remain available for human review and are marked as requiring review for automated processing.

## Dependable result checks

Completeness requires every expected substance in the configured panel. Having 15 or 17 rows is insufficient if a row is duplicated or a different substance replaced a required one. Unknown results, unsupported methods and conflicting positives/negatives remain flagged; a later negative duplicate cannot erase a positive.

Instant results retain individual rows with substance, laboratory result, method, cutoff text and source page/bounds. Lab confirmations retain individual analytes, numeric comparisons, printed cutoff, measured value and source bounds, plus the grouped substance results used by existing forms. Summary concentrations are matched to their individual analyte. Calculated creatinine ratios are not drug concentrations or assay results.

Numeric confirmation is interpreted only with a usable printed cutoff and compatible units. `<5 ng/mL` against a 5 ng/mL cutoff is below cutoff; `<100 ng/mL` against that cutoff is ambiguous. Unknown extraction is distinct from an actual inconclusive laboratory result.

Identity fields are read from label regions, including split labels/names and neighboring columns. Collection timestamps must come from Collected, not the first date anywhere in the PDF. Calendar errors, nonexistent or ambiguous Eastern-time timestamps, and conflicting identities require correction/review. Dates are date-only when used as DOB.

Specimen validity uses shared rules. `specimenValidityStatus` explicitly distinguishes `dilute`, `not-dilute`, `unreported` and `unverified`. Statements in disclaimers are ignored. Ambiguous creatinine bounds and conflicting validity statements require review. The legacy `isDilute` boolean remains for current manual forms; **an automated importer must not use its default false to overwrite existing validity when the status is unreported or unverified**.

## Preparing for automation

The response includes:

```ts
{
  parserVersion: 'pdfjs-regions-v2',
  reportFamily: 'instant' | 'lab',
  requiresReview: boolean,
  reviewReasons: string[],
  resultsComplete: boolean,
  // identity, panel, screening/confirmation data and source coordinates
}
```

`assertReportParsedWithoutReview(report)` rejects incomplete, ambiguous, unanchored or inferred reads. Review reasons are machine-readable, rather than requiring a caller to interpret UI wording or a confidence percentage. Confidence is an evidence score, not a calibrated probability, and cannot authorize an import by itself.

This is a parse-quality gate, not an automatic upload or publication workflow. A future importer must parse the actual bytes server-side, uniquely match the verified client/DOB/collection/panel and expected record stage, preserve unreported fields and pending requested confirmations, and deduplicate uploads. Ambiguous record matches require review. Client JSON or cached parser flags are not authorization. Medication expectations, result decisions, payments and notification rules remain outside PDF interpretation. Automation is not enabled by this change.

Human entry continues to allow corrections after a partial but readable extraction. A failed/loading extraction cannot advance: the readiness flag is cleared and the active step schema requires successful extraction. This prevents a previous report's readiness state from accepting a failed replacement.

## Verification

- Every configured instant/lab panel has required PDF coverage. Missing fixtures fail rather than skipping assertions.
- Fictional in-memory PDFs exercise actual PDF.js, reversed drawing order, different column order, split/wrapped cells, repeated pages, missing/extra/duplicate substances, conflicting results, unsupported methods, wrong-family uploads, invalid timestamps and validity bounds.
- Regression tests prove one PDF.js read per public call and compatibility adapter, and enforce the same 10MB limit before reading.
- The 17-panel instant, 8-panel lab and 17-panel SOS synthetic fixture lists were corrected to their actual configured substances. The corrected PDFs were rendered and inspected.
- Existing report parsing, confirmation aggregation, classification and import safeguards remain covered. Source fixtures use fictional or explicitly sanitized data; production files are never committed.

Run the aggregate-only private corpus audit:

```sh
pnpm audit:pdf-parsing -- /path/to/private/reports
```

It uses the same parser and reports counts, completeness, confidence and manual-review totals without names, report text or private paths. The available six real examples (three instant, three lab including one confirmation) pass without warnings or manual-review flags. Additional provider layouts are still useful validation input. Image-only PDFs have no supported text layout and require a readable replacement or a future explicit manual/OCR path.

Local verification passed 975 tests across 135 files, TypeScript, and scoped ESLint with no errors. Existing `any` warnings remain in the wizard action files. CI remains the eight essential Chromium smoke cases; current CI status is recorded separately in the PR. Detailed validation and WebKit remain local. Result-classification, payment and notification services are unchanged. No migration, deployment or automatic uploader is included.
