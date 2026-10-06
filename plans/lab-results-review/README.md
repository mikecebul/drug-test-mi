# Unified lab results: design and parser work

The two jobs remain separate. These generated mockups propose a unified **Lab results** workflow; the current screen and confirmation UI routes remain in place. The parser implementation supports the proposed report detection without replacing those UI routes.

## Design proposal

[Open the gallery](review.html).

1. **Upload** — one PDF entry point. Extraction runs here rather than requiring a separate extraction step.
2. **Match** — identify the client and choose the eligible collection. A headshot, DOB, collection date and panel keep identity and collection selection clear. Completed collections are not selectable import targets. Name/DOB mismatches reuse the approved explicit comparison design.
3. **Results** — the same page shape branches by report content. Screening uses the compact expected/detected summary and result decision; confirmation shows a compact substance table with individual analytes behind disclosure. Mixed reports preserve the original screen and review confirmation separately. Medications use the collection-time snapshot as text, not pictures. Optional test edits stay collapsed. A substance with several measured analytes shows an analyte count rather than presenting one compound's concentration as the entire drug class.
4. **Review** — reuse the approved compact recipient/PDF review. No additional payment step is required for ordinary lab-result entry; existing confirmation-payment requirements and balance behavior must remain part of implementation planning.

Green means expected or clear; red marks unexpected positives; amber explicitly labels unverified extraction. A missing read is never displayed as negative. Identity, completeness and result classification are distinct checks. All unverified results need a technician correction or explicit verification before final delivery. PDFs with two clients or collection times are rejected rather than merged.

Detection suggests the result-entry branch; it never updates a record automatically. The matched collection's stage and requested confirmation substances must be checked. A confirmation-only upload retains the stored screen, medications and specimen-validity data. Requested confirmations not yet reported remain pending instead of making the entire test final. Manual corrections remain available.

The mockups use fictional client details. Generated with the built-in image tool; the full prompts and references are in [prompts.json](prompts.json).

- [Collection matching](images/01-match-lab-report-v2.png)
- [Screening review](images/02-review-screening.png)
- [Confirmation review](images/03-review-confirmation.png)

## Implemented parser changes

Subsequent work consolidated **instant and lab reports** behind `parseDrugTestReport`, with one PDF.js read, one shared table-region engine, and explicit parse-review metadata. Compatibility function names forward to that same pipeline. The application and audit use the unified API. See [the current parser contract](../../docs/pdf-report-parsing.md) for the format profiles, completeness checks and future automation requirements. The proposed lab UI remains unchanged.

The code already loaded PDF.js directly, with the worker and Node geometry support needed by deployment. Those runtime imports are retained. The rebuild replaces fixed item-order interpretation with regions anchored to the PDF's own Method, Cutoff and Result headers. Screening and confirmation column groups are independent; table movement, split cells and repeated page headings do not change field ownership. A bounded fallback retains supported older reports without headings.

The parser returns `reportKind`, DOB, separate screening/confirmation presence, confirmation completeness, and detailed analytes with cutoff, measured quantity, laboratory result and source page/bounds. It preserves the existing grouped confirmation results consumed by the current forms. Quantities shown in Summary are matched to an individual analyte; normalized creatinine ratios are excluded. Positive screening data stays separate from confirmation outcomes.

Explicit laboratory classifications take precedence. Numeric results are compared with the printed cutoff in compatible units. Ambiguous bounds, missing cutoffs/units, contradictory values, unmapped substances and conflicting duplicate analytes stay unverified. Existing meaningful inconclusive lab results remain distinct from unreadable data. Common benzodiazepine metabolites map to the existing class; unsupported Methaqualone no longer maps to unrelated tricyclic antidepressants.

The current screening save actions reject incomplete confirmation and confirmation-only reports before file uploads, writes or emails. The existing confirmation workflow remains available for technician correction. Its form fields and backend classification/payment lifecycle are retained.

## Verification and limits

Regression tests exercise PDF.js with fictional in-memory PDFs drawn out of order, variable table locations, dual columns, split cells, repeated headers, summary-only concentrations, duplicates, malformed values, multiple clients/collections, every existing supported panel, and the no-write confirmation safeguard.

Latest local verification: 975 tests across 135 files passed; TypeScript passed. Scoped ESLint has no errors; existing `any` warnings remain in action files. The unified private-report audit found six readable reports (three lab, one with confirmation, and three instant), with no incomplete extractions, warnings or manual-review flags. The existing eight-case CI smoke suite remains unchanged; CI status is recorded in the PR separately.

Local private-report auditing emits aggregate counts only. The available examples include three lab reports, one with confirmation, and three instant reports; production PDFs and identifying data are not copied into this branch. Broader real confirmation examples are still useful to validate additional vendor layouts. This is text-based extraction, not OCR: image-only or unfamiliar reports require review.

API reference: [PDF.js TextItem coordinates](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html#~TextItem). Source rectangles are retained for a future PDF highlighting/viewer feature; that viewer is not implemented here.
