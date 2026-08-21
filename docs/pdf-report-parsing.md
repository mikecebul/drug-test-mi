# PDF report parsing

Drug-test reports are parsed on the server with PDF.js directly. The implementation imports `pdfjs-dist/legacy/build/pdf.mjs`; `pdf-parse` is intentionally not used.

## Why coordinates matter

Flattened PDF text does not preserve table relationships. On Redwood reports, a screen row and an LC-MS/MS row may contain the same substance while their results live in different columns. Additional positive analytes also insert rows and move every later result vertically. Matching a substance against the next occurrence of `Positive` or `Negative` in flattened text can therefore associate it with another row or with the report glossary.

`pdfText.ts` retains each text item's page, x/y origin, width, and height. Items with the same page and baseline are reconstructed into a row and ordered by x-coordinate. The report parsers then use stable column anchors:

- Instant reports: the `CIA` method cell anchors a row; the result is the status cell to its left and the substance is the leftmost cell.
- Lab screens: the `EIA` method cell anchors most rows, while B829 Alcohol (Ethanol) uses `EA`; the next cell is the cutoff and the following cell is the screen result.
- Specimen validity: the `Colorimetric` method cell anchors the creatinine row; the next cell is the reference range and the following cell is the measured result.
- Lab confirmations: an exact `LC/MS/MS` method cell anchors a row; the next cell is the cutoff and the following cell is the confirmation result.

Requiring a complete same-row structure prevents footer definitions such as “LC-MS/MS - Liquid Chromatography Tandem Mass Spectrometry” from being treated as test results.

## Confirmation aggregation

A requested substance can produce several LC-MS/MS analyte rows. Fentanyl, for example, may have rows for fentanyl, norfentanyl, and analogs. Rows are mapped to the parent substance and aggregated using this precedence:

1. Any confirmed-positive analyte makes the parent confirmed positive.
2. Otherwise, any inconclusive analyte makes the parent inconclusive.
3. Otherwise, parsed analytes are confirmed negative.

Metabolite labels such as THC-COOH and Mitragynine are mapped to the application's `thc` and `kratom` values.

## Confidence

Confidence is evidence-based rather than “name and date were found.” The score includes:

- Test type identification: 10 points
- Donor name anchored to its report label: 25 points
- Collection timestamp anchored to its report label: 25 points
- Expected screening rows reconstructed from method/result columns: 30-35 points
- Creatinine specimen-validity row reconstructed from method/result columns: 10 points for lab reports
- Confirmation analyte rows reconstructed from method/result columns: 5 points for lab reports
- Instant DOB and sex anchors: 5 points

Scores of 85 or more are high, 60-84 are medium, and lower scores are low. A complete lab screen with anchored identity fields and its creatinine result reaches 100. Missing result rows are capped below high confidence, generate a visible manual-review warning, and prevent the UI from displaying “All Negative.”

Label-anchored identity fields receive more weight than compatibility fallbacks. Any LC-MS/MS row with an unmapped analyte or unrecognized result prevents a high-confidence confirmation parse.

A report summary that says “Confirmed Positive” while yielding no confirmation row forces low confidence and a manual-review warning.

## Regression matrix

Synthetic or explicitly sanitized PDFs may be committed. Production reports must remain outside the repository. Local paths are configured with environment variables:

| Variable | Required case |
| --- | --- |
| `INSTANT_SCREEN_PDF` | Representative instant report |
| `INSTANT_MULTI_POSITIVE_PDF` | Instant report positive for THC and EtG |
| `LAB_11_SCREEN_PDF` | Representative 11-panel lab screen |
| `LAB_MULTI_POSITIVE_PDF` | Lab screen positive for THC and EtG |
| `LAB_CONFIRMED_POSITIVE_PDF` | LC-MS/MS confirmed-positive report |
| `LAB_CONFIRMED_NEGATIVE_PDF` | LC-MS/MS confirmed-negative report, preferably with multiple analytes |
| `NO_ETG_LAB_PDF` | B829 no-EtG panel |
| `LAB_17_SOS_PDF` | B306 17-panel SOS report |
| `LAB_ETG_PDF` | 049/050 EtG-only report |

The local test matrix asserts extracted substances, physical result-row counts, row completeness, confirmation aggregation, confidence, and warnings. Actual reports and client-identifying file paths must not appear in commits, snapshots, Playwright traces, or CI artifacts.

Run the privacy-safe corpus audit against one or more directories outside the repository:

```sh
pnpm audit:pdf-parsing -- /path/to/private/reports
```

The audit prints aggregate counts only. It never prints donor names, report text, or input paths.

## Browser coverage

PDF.js executes in the server action, so parsing output is browser-independent. Browser tests still cover the upload and server-action boundary in Chromium and WebKit because Safari differs in file input, multipart request, and response handling. Playwright WebKit is regression coverage, not a substitute for a final smoke test in real Safari.

## Production runtime

PDF.js 6 requires `DOMMatrix` and `Path2D` while its legacy module initializes in Node. The extractor loads those APIs from the direct production dependency `@napi-rs/canvas` before importing PDF.js. It also preloads PDF.js' in-process worker so Next's standalone output tracer includes `pdf.worker.mjs`. The Docker build validates that both runtime pieces survived tracing and fails before deployment if either is missing.

## Remaining limits

- Scanned/image-only PDFs require OCR and intentionally return incomplete/low-confidence results.
- A newly introduced lab method or analyte label may remain unmapped; this produces a warning instead of silently marking the report negative.
- Absolute page positions are deliberately avoided. Same-row geometry and method-column anchors tolerate vertical movement as positive analyte rows are added.
