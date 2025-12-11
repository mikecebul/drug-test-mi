# PDF Upload Wizard - Implementation Plan

**Approach:** Pragmatic Balance with PayloadCMS Search Plugin
**Estimated Time:** 10-12 hours
**Status:** Ready for Implementation

---

## Overview

Create a multi-step wizard for uploading drug test PDFs, extracting data, matching clients, and creating drug test records with full admin verification at each step.

### Key Features

- ✅ PDF upload and text extraction (pdf-parse)
- ✅ Auto-detection of 15-panel instant test format
- ✅ Client matching using PayloadCMS search plugin (exact + fuzzy)
- ✅ Admin verification at every step
- ✅ Medication preview during verification
- ✅ Full integration with existing `computeTestResults` hook

---

## Key Changes

1. **Add `@payloadcms/plugin-search`** to PayloadCMS config
2. **Enable search on Clients collection** (`firstName`, `lastName`, `email`)
3. **Use `_search` in where queries** for client matching
4. **Much simpler client matching code** (no Levenshtein distance needed!)

---

## Installation

### 1. Install Dependencies

```bash
pnpm add @payloadcms/plugin-search pdf-parse
```

### 2. Configure Search Plugin in `payload.config.ts`

Add to plugins array:

```typescript
import { searchPlugin } from '@payloadcms/plugin-search'

export default buildConfig({
  // ... other config
  plugins: [
    // ... existing plugins
    searchPlugin({
      collections: ['clients'],
      defaultPriorities: {
        clients: 10,
      },
    }),
  ],
})
```

### 3. Enable Search on Clients Collection

Modify `/src/collections/Clients/index.ts`:

```typescript
export const Clients: CollectionConfig = {
  slug: 'clients',
  // ... existing config
  admin: {
    defaultColumns: ['headshot', 'lastName', 'email', 'clientType'],
    useAsTitle: 'name',
    listSearchableFields: ['email', 'firstName', 'lastName'], // Already there!
  },
  // No additional config needed - plugin handles it!
}
```

### 4. Add Middle Initial Field to Clients

Add after `lastName` field (around line 252):

```typescript
{
  name: 'middleInitial',
  type: 'text',
  maxLength: 1,
  admin: {
    description: 'Middle initial (optional, single letter for precise matching)'
  }
}
```

### 5. Regenerate Types

```bash
pnpm generate:types
```

---

## Implementation Structure

### Files to Create

| File Path | Purpose | Est. Lines |
|-----------|---------|------------|
| `/src/utilities/extractors/extract15PanelInstant.ts` | PDF text parsing for 15-panel instant tests | 120 |
| `/src/components/ui/stepper.tsx` | Reusable stepper component | 50 |
| `/src/components/views/PDFUploadWizard/index.tsx` | Server component wrapper | 30 |
| `/src/components/views/PDFUploadWizard/PDFUploadWizardClient.tsx` | Wizard state machine | 100 |
| `/src/components/views/PDFUploadWizard/steps/UploadStep.tsx` | Step 1: File upload | 60 |
| `/src/components/views/PDFUploadWizard/steps/ExtractStep.tsx` | Step 2: Show extracted data | 80 |
| `/src/components/views/PDFUploadWizard/steps/VerifyClientStep.tsx` | Step 3: Client matching | 120 |
| `/src/components/views/PDFUploadWizard/steps/VerifyDataStep.tsx` | Step 4: Data verification | 140 |
| `/src/components/views/PDFUploadWizard/steps/ConfirmStep.tsx` | Step 5: Final confirmation | 80 |
| `/src/app/(payload)/admin/[[...segments]]/drug-test-upload/page.tsx` | Admin page route | 30 |
| `/src/app/(payload)/admin/[[...segments]]/drug-test-upload/actions.ts` | Server actions | 150 |
| `/src/components/afterNavLinks/PDFUploadLink.tsx` | Navigation link | 15 |

**Total:** 11 new files (~975 lines)

### Files to Modify

| File Path | Changes | Location |
|-----------|---------|----------|
| `/src/collections/Clients/index.ts` | Add `middleInitial` field | After line 252 |
| `/src/payload.config.ts` | Register search plugin, custom view, nav link | Multiple locations |

---

## Server Actions Implementation

### File: `/src/app/(payload)/admin/[[...segments]]/drug-test-upload/actions.ts`

```typescript
'use server'

import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Search for matching clients using PayloadCMS search plugin
 */
export async function searchClients(searchTerm: string) {
  const payload = await getPayload({ config })

  // Use built-in search - searches firstName, lastName, email
  const results = await payload.find({
    collection: 'clients',
    where: {
      _search: searchTerm, // Magic! Plugin handles fuzzy matching
    },
    limit: 10,
    sort: '-_searchScore', // Higher score = better match
  })

  return {
    matches: results.docs.map(client => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      middleInitial: client.middleInitial,
      email: client.email,
      score: client._searchScore || 0, // Plugin provides relevance score
    })),
    total: results.totalDocs,
  }
}

/**
 * Try exact match first, then fall back to search
 */
export async function findMatchingClients(
  firstName: string,
  lastName: string,
  middleInitial?: string
) {
  const payload = await getPayload({ config })

  // 1. Try exact match first (fastest)
  const exactMatch = await payload.find({
    collection: 'clients',
    where: {
      and: [
        { firstName: { equals: firstName } },
        { lastName: { equals: lastName } },
        ...(middleInitial ? [{ middleInitial: { equals: middleInitial } }] : []),
      ],
    },
    limit: 5,
  })

  if (exactMatch.docs.length > 0) {
    return {
      matches: exactMatch.docs.map(client => ({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial,
        email: client.email,
        matchType: 'exact' as const,
      })),
      searchTerm: `${firstName} ${lastName}`,
    }
  }

  // 2. No exact match - use fuzzy search
  const searchTerm = middleInitial
    ? `${firstName} ${middleInitial} ${lastName}`
    : `${firstName} ${lastName}`

  const fuzzyResults = await payload.find({
    collection: 'clients',
    where: {
      _search: searchTerm,
    },
    limit: 10,
    sort: '-_searchScore',
  })

  return {
    matches: fuzzyResults.docs.map(client => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      middleInitial: client.middleInitial,
      email: client.email,
      matchType: 'fuzzy' as const,
      score: client._searchScore || 0,
    })),
    searchTerm,
  }
}

/**
 * Extract data from uploaded PDF
 */
export async function extractPdfData(formData: FormData) {
  const file = formData.get('file') as File
  if (!file) {
    return { success: false, error: 'No file provided' }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { extract15PanelInstant } = await import('@/utilities/extractors/extract15PanelInstant')

    const extracted = await extract15PanelInstant(buffer)

    return { success: true, data: extracted }
  } catch (error) {
    return {
      success: false,
      error: `Failed to extract PDF data: ${error.message}`
    }
  }
}

/**
 * Create drug test record with admin privileges
 */
export async function createDrugTest(data: {
  clientId: string
  testType: string
  collectionDate: string
  detectedSubstances: string[]
  isDilute: boolean
  pdfBuffer: Buffer
  pdfFilename: string
}) {
  const payload = await getPayload({ config })

  try {
    // 1. Upload PDF to private-media
    const uploadedFile = await payload.create({
      collection: 'private-media',
      data: {
        relatedClient: data.clientId,
        documentType: 'drug-test-report'
      },
      file: {
        data: data.pdfBuffer,
        mimetype: 'application/pdf',
        name: data.pdfFilename,
        size: data.pdfBuffer.length
      },
      overrideAccess: true
    })

    // 2. Create drug test (computeTestResults hook will run automatically)
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: {
        relatedClient: data.clientId,
        testType: data.testType,
        collectionDate: data.collectionDate,
        detectedSubstances: data.detectedSubstances,
        isDilute: data.isDilute,
        testDocument: uploadedFile.id,
        screeningStatus: 'screened',
        processNotes: 'Created via PDF upload wizard'
      },
      overrideAccess: true
    })

    return { success: true, testId: drugTest.id }
  } catch (error) {
    return {
      success: false,
      error: `Failed to create drug test: ${error.message}`
    }
  }
}
```

---

## Sample UI Code: Step 3 - Verify Client

```typescript
'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@payloadcms/ui'
import { findMatchingClients, searchClients } from '../actions'

export function VerifyClientStep({ parsedData, onNext, onBack }) {
  const [matches, setMatches] = useState([])
  const [manualSearch, setManualSearch] = useState('')

  useEffect(() => {
    if (parsedData.clientName) {
      const [firstName, ...rest] = parsedData.clientName.split(' ')
      const lastName = rest.join(' ')

      findMatchingClients(firstName, lastName).then(result => {
        setMatches(result.matches)
      })
    }
  }, [parsedData])

  const handleManualSearch = async (term: string) => {
    const results = await searchClients(term)
    setMatches(results.matches)
  }

  return (
    <div>
      <h2>Verify Client</h2>

      {matches.length > 0 && (
        <div>
          <h3>Found {matches.length} match(es)</h3>
          {matches.map(match => (
            <div key={match.id} className="match-card">
              <p><strong>{match.firstName} {match.lastName}</strong></p>
              <p>{match.email}</p>
              <p className="match-type">
                {match.matchType === 'exact' ? (
                  <span className="text-green-600">✓ Exact Match</span>
                ) : (
                  <span className="text-blue-600">
                    ~{Math.round((match.score || 0) * 100)}% Match
                  </span>
                )}
              </p>
              <Button onClick={() => onNext(match)}>Select</Button>
            </div>
          ))}
        </div>
      )}

      {/* Manual search fallback */}
      <div className="manual-search">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={manualSearch}
          onChange={(e) => setManualSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSearch(manualSearch)}
        />
        <Button onClick={() => handleManualSearch(manualSearch)}>
          Search
        </Button>
      </div>

      <div className="actions">
        <Button onClick={onBack}>Back</Button>
      </div>
    </div>
  )
}
```

---

## Benefits of This Approach

✅ **Eliminates custom fuzzy matching code** - PayloadCMS plugin handles it
✅ **Consistent with existing patterns** - Your `listSearchableFields` already defines what's searchable
✅ **Better performance** - Plugin uses database indexes
✅ **Reusable across app** - Once configured, any collection can use `_search`
✅ **Automatic relevance scoring** - No manual Levenshtein calculations
✅ **Less code to maintain** - ~40 lines instead of ~120 lines for Fuse.js approach

---

## Implementation Plan (Phased)

### Phase 1: Setup (15 minutes)

1. ✅ Install `@payloadcms/plugin-search` and `pdf-parse`
2. ✅ Add search plugin to `payload.config.ts`
3. ✅ Add `middleInitial` field to Clients collection
4. ✅ Run `pnpm generate:types`

### Phase 2: Extraction Logic (2-3 hours)

1. Create `/src/utilities/extractors/extract15PanelInstant.ts`
2. Test with your sample PDF to validate regex patterns
3. Handle edge cases (missing fields, unclear formatting)

### Phase 3: Wizard Shell (2-3 hours)

1. Create Stepper UI component (`/src/components/ui/stepper.tsx`)
2. Create 5 step components (Upload, Extract, VerifyClient, VerifyData, Confirm)
3. Create wizard orchestrator (`PDFUploadWizardClient.tsx`)

### Phase 4: Server Actions (1-2 hours)

1. `extractPdfData()` - call PDF parser
2. `findMatchingClients()` - use `_search` query
3. `createDrugTest()` - create record with `overrideAccess`

### Phase 5: Integration (1 hour)

1. Register custom view in `payload.config.ts`
2. Add navigation link
3. Add dashboard button

### Phase 6: Testing & Polish (1-2 hours)

1. Test with real PDF
2. Test client matching with various name formats
3. Error handling and loading states

**Total Time: 10-12 hours** (slightly faster than before due to simpler client matching)

---

## Workflow Diagram

```
┌─────────────────────────────────────────────┐
│ Step 1: Upload PDF                          │
│ - File validation (type, size)             │
│ - Admin uploads PDF file                   │
└─────────────┬───────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────┐
│ Step 2: Extract Data                        │
│ - Parse PDF text (pdf-parse)               │
│ - Extract: name, date, substances          │
│ - Show extracted data for review           │
│ - Admin confirms or goes back              │
└─────────────┬───────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────┐
│ Step 3: Verify Client                       │
│ - Search for client (exact match first)    │
│ - If no exact match, use _search (fuzzy)   │
│ - Show matches with scores                 │
│ - Manual search fallback                   │
│ - Admin selects correct client             │
└─────────────┬───────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────┐
│ Step 4: Verify Data                         │
│ - Show client name + medications           │
│ - Editable form with all test data         │
│ - Admin reviews and adjusts                │
│ - Medication preview for context           │
└─────────────┬───────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────┐
│ Step 5: Confirm & Create                    │
│ - Show final summary                        │
│ - Upload PDF to private-media               │
│ - Create drug test record                  │
│ - computeTestResults hook runs              │
│ - Redirect to drug test details            │
└─────────────────────────────────────────────┘
```

---

## Extension Path: Adding Lab Test Formats

When you need to add 11-panel lab, 17-panel SOS, or EtG formats:

1. **Create new extractor file**:
   - Copy `/src/utilities/extractors/extract15PanelInstant.ts`
   - Rename to `extract11PanelLab.ts`
   - Adapt regex patterns for lab format

2. **Update server action**:
   - Modify `extractPdfData()` to detect format
   - Route to correct extractor function

3. **Test with sample PDF**:
   - Validate extraction accuracy
   - Handle lab-specific fields

**Estimated time per format:** 1-2 hours

---

## Key Technical Decisions

### Why PayloadCMS Search Plugin over Fuse.js?

- ✅ Native integration with PayloadCMS ecosystem
- ✅ Uses database indexes (better performance)
- ✅ Automatic relevance scoring
- ✅ Reusable across entire application
- ✅ Simpler code (~40 lines vs. ~120)
- ✅ No additional client-side bundle size

### Why pdf-parse?

- ✅ Lightweight and reliable
- ✅ Works server-side (Next.js server actions)
- ✅ Good for text-based PDFs (your use case)
- ✅ Simple API, easy to debug

### Why Multi-Step Wizard?

- ✅ Admin verification at each step (accuracy requirement)
- ✅ Clear UX flow (easier to train new staff)
- ✅ Error handling at each stage
- ✅ Can go back and adjust data before commit

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Upload valid 15-panel PDF → extraction works
- [ ] Upload invalid PDF → shows clear error
- [ ] Exact client match → shows 100% match
- [ ] No exact match → shows fuzzy matches with scores
- [ ] Manual search → finds clients by partial name
- [ ] Edit extracted data → changes persist to creation
- [ ] Complete flow → drug test appears in admin panel
- [ ] Verify `computeTestResults` hook runs
- [ ] Check client medications display correctly
- [ ] Test with client names containing middle initials

### Edge Cases to Handle

- PDF with middle initial vs client without
- Client name variations (Jr., Sr., III, etc.)
- Missing test date in PDF
- Unclear substance detection (faint lines)
- Very large client database (>1000 clients)
- PDF file size limits (recommend <10MB)

---

## Future Enhancements (Out of Scope)

1. **Bulk Upload**: Process multiple PDFs at once
2. **OCR Support**: Handle scanned PDFs (currently text-only)
3. **Client Creation**: Create new client from wizard if not found
4. **Barcode Recognition**: Parse client IDs from barcodes
5. **Multi-Language Support**: Internationalize wizard UI
6. **Audit Log**: Track all PDF uploads and extractions
7. **Template Management**: Admin-configurable parsing templates

---

## Success Metrics

After implementation, measure:

- **Time saved**: Compare PDF upload flow vs. manual entry
- **Accuracy**: Track how often admins need to manually adjust extracted data
- **Adoption**: How frequently is wizard used vs. manual entry
- **Error rate**: How often does extraction fail or require correction

---

## Support & Documentation

### For Admins Using the Wizard

1. Navigate to "Upload PDF" in admin navigation
2. Upload your 15-panel instant test PDF
3. Review extracted data (name, date, substances)
4. Verify correct client is selected
5. Adjust any fields if needed
6. Confirm and create drug test

### For Developers Adding New Formats

1. Copy existing extractor template
2. Adapt regex patterns for your format
3. Update server action routing
4. Test with sample PDF
5. Document format-specific patterns

---

## Notes

- **First Implementation:** Focus on 15-panel instant tests only
- **Extensibility:** Architecture supports adding lab formats later
- **Client Matching:** Exact match first, then fuzzy via PayloadCMS search
- **Verification:** Admin must verify at every step before proceeding
- **Hook Integration:** Existing `computeTestResults` hook runs automatically on save
- **Access Control:** Wizard is admin-only (via PayloadCMS access functions)

---

**Last Updated:** 2025-01-19
**Status:** Ready for Implementation
