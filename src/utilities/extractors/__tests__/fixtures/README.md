# PDF regression fixtures

These committed reports are required by the extractor tests. Missing or unreadable
fixtures fail the suite; they never silently skip an assertion in CI.

Regenerate the synthetic reports from the repository root:

```sh
node scripts/generate-test-report-fixtures.mjs
```

The generator uses fictional donors, fixed dates, and positioned PDF table cells.
It also generates the lab-screen and lab-confirmation browser fixtures in
`tests/e2e/fixtures/`, whose donor names and dates match the seeded pending tests.
The two existing 17-panel instant PDFs remain as sanitized layout regressions.

Coverage includes every supported lab panel, 15/17-panel instant reports,
all-negative and multiple-positive results, dilute specimens, incomplete rows,
and confirmed-positive, confirmed-negative, and inconclusive analytes. Tests
assert exact detected substances and identity, collection time, row completeness,
and confidence rather than checking only that the return type looks valid.

Panel completeness uses the configured substance set, not just a row count.
The 17-panel instant fixture includes Barbiturates/Morphine rather than
6-MAM/Opiates; the 8-panel lab and 17-panel SOS fixtures use their actual
configured substances. Synthetic in-memory PDFs additionally cover reordered
columns, wrapped/split cells, contradictory and duplicate rows, unsupported
methods, identity conflicts, invalid dates and the automatic-processing gate.

Keep production reports outside the repository or in ignored
`.pdf-test-reports/`. Inspect local reports with
`pnpm audit:pdf-parsing -- /path/to/private/reports`; those reports are not required
for CI. The audit emits aggregate counts without report text or donor names.
