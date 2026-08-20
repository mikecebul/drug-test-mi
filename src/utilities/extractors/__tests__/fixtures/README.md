# Test Fixtures

This directory contains PDF test fixtures for the extractor tests.

## Setup for Local Development

The committed PDFs in this directory must be synthetic or explicitly sanitized. Test production reports from their existing location on the developer laptop by setting the local-only environment variables in `.env.example`.

### Required Files

Synthetic fixtures may use the following structure:

```
fixtures/
├── 11-panel-lab/
│   ├── screening.pdf       # 11-panel lab screening result
│   └── confirmation.pdf    # 11-panel lab with confirmation results
├── 11-panel-lab-no-etg/
│   └── screening.pdf       # B829 11-panel lab screening result with Alcohol (Ethanol), no EtG
├── 17-panel-sos-lab/
│   └── screening.pdf       # 17-panel SOS lab screening result
├── etg-lab/
│   └── screening.pdf       # EtG lab screening result
└── 15-panel-instant/
    └── screening.pdf       # 15-panel instant test result
└── 17-panel-instant/
    ├── all-neg.pdf         # 17-panel instant all-negative result
    └── pos-kratom-morphine.pdf # 17-panel instant positive result
```

### File Naming Convention

Files should follow this pattern: `{test-type}/{result-type}.pdf`

### CI/CD Behavior

Tests that require fixtures will be **skipped** when the fixture files are not present.
This allows CI/CD pipelines to pass while still running all other tests.

The local regression matrix supports separate report variants for all-negative, multi-positive, lab screen, and LC-MS/MS confirmed-positive/confirmed-negative cases. Paths are supplied through environment variables so neither reports nor client-identifying paths are committed.

### Important Notes

- Do NOT commit actual PDF files to the repository (they may contain PII)
- Store production reports outside the repository, or under the ignored `.pdf-test-reports/` directory
- PDF.js is used directly through `pdfjs-dist/legacy/build/pdf.mjs`; tests assert coordinate-derived row completeness as well as extracted values
- For CI/CD, consider creating synthetic/mock PDF fixtures without real data
