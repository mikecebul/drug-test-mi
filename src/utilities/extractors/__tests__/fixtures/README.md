# Test Fixtures

This directory contains PDF test fixtures for the extractor tests.

## Setup for Local Development

To run the PDF extractor tests locally, you need to add sample PDF files to this directory.

### Required Files

Create the following subdirectories and add sample PDFs:

```
fixtures/
├── 11-panel-lab/
│   ├── screening.pdf       # 11-panel lab screening result
│   └── confirmation.pdf    # 11-panel lab with confirmation results
├── 17-panel-sos-lab/
│   └── screening.pdf       # 17-panel SOS lab screening result
├── etg-lab/
│   └── screening.pdf       # EtG lab screening result
└── 15-panel-instant/
    └── screening.pdf       # 15-panel instant test result
```

### File Naming Convention

Files should follow this pattern: `{test-type}/{result-type}.pdf`

### CI/CD Behavior

Tests that require fixtures will be **skipped** when the fixture files are not present.
This allows CI/CD pipelines to pass while still running all other tests.

### Important Notes

- Do NOT commit actual PDF files to the repository (they may contain PII)
- Add `fixtures/**/*.pdf` to `.gitignore` if not already present
- For CI/CD, consider creating synthetic/mock PDF fixtures without real data
