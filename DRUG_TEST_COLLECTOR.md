# Drug Test Collector - Documentation

**Component:** Drug Test Collector (formerly PDF Upload Wizard)
**Location:** `/src/components/views/PDFUploadWizard/` (to be renamed to `DrugTestCollector`)
**Purpose:** Multi-step wizard for collecting drug test data from PDFs or manual entry

---

## Overview

The Drug Test Collector is a comprehensive workflow system for processing drug test results. It supports multiple test types and workflows:

1. **Instant Screening** (15-panel) - Upload PDF, extract data, create test record
2. **Lab Collection** - Record that sample was collected and sent to lab
3. **Lab Screening** (11-panel) - Upload lab PDF, extract screening results, update existing test
4. **Lab Confirmation** - Upload confirmation PDF, update test with confirmation results

### Key Features

- ✅ PDF upload and automated data extraction
- ✅ Support for multiple test formats (15-panel instant, 11-panel lab)
- ✅ Client matching with fuzzy search
- ✅ Admin verification at every step
- ✅ Medication preview during verification
- ✅ Email notification system integration
- ✅ Full integration with `computeTestResults` and `sendNotificationEmails` hooks

---

## Current State (15-Panel Instant Tests)

### Implemented Features

**6-Step Wizard:**
1. Upload PDF
2. Extract Data (auto-parsing with pdf2json)
3. Verify Client (exact + fuzzy matching)
4. Verify Data (edit substances, date, dilute flag)
5. Confirm (summary preview)
6. Review Emails (customize recipients before sending)

**Key Files:**
- `/src/components/views/PDFUploadWizard/PDFUploadWizardClient.tsx` - Wizard orchestrator
- `/src/utilities/extractors/extract15PanelInstant.ts` - PDF parser for 15-panel instant tests
- `/src/components/views/PDFUploadWizard/actions.ts` - Server actions
- `/src/components/views/PDFUploadWizard/field-groups/` - Step components

**Integration Points:**
- `DrugTests` collection hooks (computeTestResults, sendNotificationEmails)
- `PrivateMedia` collection (secure PDF storage)
- Email system (Resend/Nodemailer)
- PayloadCMS search plugin (client matching)

---

## Planned Enhancement: 11-Panel Lab Test Support

**Status:** Ready for Implementation
**Approach:** Pragmatic - Extend existing wizard with lab test support
**Estimated Time:** 16 hours (2 days)

### Requirements Summary

**Four Workflow Types:**
1. **Instant Screen** (existing) - Upload 15-panel PDF → create test
2. **Lab Collection** (new) - Record sample collected → create test with status='collected'
3. **Lab Screening** (new) - Upload 11-panel PDF → update existing test with screening results
4. **Lab Confirmation** (new) - Upload confirmation PDF → update test with confirmation results

**Key Decisions:**
- Use existing 6-step wizard structure (reuse steps where possible)
- Build new PDF parser for 11-panel lab format
- Add test type selector in Step 1 (Upload)
- Conditional UI for confirmation data display
- Auto-detect test type from PDF content

---

## Implementation Plan - 11-Panel Lab Tests

### Phase 1: Foundation (4 hours)

#### 1.1 Create 11-Panel Lab PDF Parser

**File:** `/src/utilities/extractors/extract11PanelLab.ts`

**Responsibilities:**
- Parse 11-panel lab PDF format (Redwood Toxicology)
- Extract screening results (Screen column: Negative/Screened Positive)
- Extract confirmation results (Confirmation column: ng/mL values)
- Map substance abbreviations (AMP, BUP, BZO, COC, ETG, FEN, MIT, MTD, OPI, THC)
- Detect test type from PDF content
- Return structured data matching `ParsedPDFData` interface

**Substance Mapping:**
```typescript
const substanceMapping = {
  'AMP': 'amphetamines',         // Amphetamines
  'BUP': 'buprenorphine',        // Buprenorphine
  'BZO': 'benzodiazepines',      // Benzodiazepines
  'COC': 'cocaine',              // Cocaine
  'ETG': 'etg',                  // Ethyl Glucuronide (Alcohol)
  'FEN': 'fentanyl',             // Fentanyl
  'MIT': 'kratom',               // Mitragynine (Kratom) - NEW
  'MTD': 'methadone',            // Methadone
  'OPI': 'opiates',              // Opiates
  'THC': 'thc',                  // THC (Marijuana)
}
```

**Interface:**
```typescript
export interface Extracted11PanelData {
  // Standard fields (same as 15-panel)
  donorName: string | null
  collectionDate: Date | null
  detectedSubstances: SubstanceValue[]  // From "Screen" column
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  extractedFields: string[]

  // Lab-specific fields
  testType: '11-panel-lab'              // Auto-detected
  hasConfirmation: boolean              // Whether confirmation data exists
  confirmationResults?: Array<{         // From "Confirmation" column
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
}
```

**Parsing Strategy:**
1. Use pdf2json library (already installed)
2. Extract text sections for Screen and Confirmation columns
3. For each substance, check both columns
4. Screen column: "Negative" or "Screened Positive"
5. Confirmation column: LC-MS/MS results with ng/mL values
6. Map to binary positive/negative (no quantitative storage)

**Error Handling:**
- Return partial data if some fields fail to parse
- Set confidence='low' if critical fields missing
- Include warning flag if confirmation data found in screening workflow

**Tests:**
```
/src/utilities/extractors/__tests__/extract11PanelLab.test.ts
- Test with screening-only PDF
- Test with screening + confirmation PDF
- Test substance mapping (including Kratom/MIT)
- Test missing fields handling
- Test dilute sample detection
```

**Estimated:** 250 lines, 6 hours

---

#### 1.2 Update Substance Options

**File:** `/src/fields/substanceOptions.ts`

**Changes:**
Add Kratom to 11-panel-lab substances list (line 57):

```typescript
export const panel11LabSubstances = [
  { label: 'Amphetamines (AMP)', value: 'amphetamines' },
  { label: 'Benzodiazepines (BZO)', value: 'benzodiazepines' },
  { label: 'Buprenorphine (BUP)', value: 'buprenorphine' },
  { label: 'Cocaine (COC)', value: 'cocaine' },
  { label: 'EtG (ETG)', value: 'etg' },
  { label: 'Fentanyl (FEN)', value: 'fentanyl' },
  { label: 'Kratom (MIT)', value: 'kratom' },        // ADD THIS
  { label: 'Methadone (MTD)', value: 'methadone' },
  { label: 'Opiates (OPI)', value: 'opiates' },
  { label: 'THC (THC)', value: 'thc' },
] as const
```

**Estimated:** 5 minutes

---

#### 1.3 Extend Type Definitions

**File:** `/src/components/views/PDFUploadWizard/types.ts`

**Changes:**
Add lab-specific fields to `ParsedPDFData` interface:

```typescript
export interface ParsedPDFData {
  donorName: string | null
  collectionDate: Date | null
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  extractedFields: string[]

  // NEW: Lab-specific fields
  testType?: TestType                    // Auto-detected test type
  hasConfirmation?: boolean              // Whether confirmation section exists
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
}
```

**Estimated:** 15 lines, 15 minutes

---

### Phase 2: Wizard Integration (4 hours)

#### 2.1 Update Upload Step - Test Type Selection

**File:** `/src/components/views/PDFUploadWizard/field-groups/UploadFieldGroup.tsx`

**Changes:**
Add test type selector BEFORE file upload:

```typescript
// Add at top of component (around line 60)
<form.Field
  name="uploadData.testType"
  defaultValue="15-panel-instant"
  validators={{
    onChange: z.enum(['15-panel-instant', '11-panel-lab']),
  }}
>
  {(field) => (
    <div>
      <Label>Test Type</Label>
      <Select
        value={field.state.value}
        onValueChange={field.handleChange}
      >
        <SelectItem value="15-panel-instant">
          15-Panel Instant Test
        </SelectItem>
        <SelectItem value="11-panel-lab">
          11-Panel Lab Test
        </SelectItem>
      </Select>
    </div>
  )}
</form.Field>
```

**Estimated:** 15 lines, 30 minutes

---

#### 2.2 Update Extract Step - Conditional Display

**File:** `/src/components/views/PDFUploadWizard/field-groups/ExtractFieldGroup.tsx`

**Changes:**
1. Show confirmation section if `hasConfirmation === true`
2. Display warning if confirmation data found in screening workflow

```typescript
// After displaying detected substances (around line 120)
{extractedData.hasConfirmation && (
  <Alert variant="info">
    <AlertTitle>Confirmation Data Detected</AlertTitle>
    <AlertDescription>
      This PDF contains confirmation testing results. The following substances
      were confirmed via LC-MS/MS:
    </AlertDescription>
    <ul className="mt-2 space-y-1">
      {extractedData.confirmationResults?.map((result) => (
        <li key={result.substance}>
          {formatSubstance(result.substance)}: {result.result}
        </li>
      ))}
    </ul>
  </Alert>
)}

{extractedData.hasConfirmation && workflow === 'lab-screening' && (
  <Alert variant="warning">
    <AlertTitle>Warning: Confirmation Data in Screening Workflow</AlertTitle>
    <AlertDescription>
      This PDF appears to contain confirmation results, but you're in the
      "Lab Screening" workflow. Consider using "Lab Confirmation" workflow instead.
    </AlertDescription>
  </Alert>
)}
```

**Estimated:** 35 lines, 45 minutes

---

#### 2.3 Update Server Actions - Parser Routing

**File:** `/src/components/views/PDFUploadWizard/actions.ts`

**Changes:**
Route to correct parser based on test type:

```typescript
/**
 * Extract data from uploaded PDF
 */
export async function extractPdfData(formData: FormData): Promise<{
  success: boolean
  data?: ParsedPDFData
  error?: string
}> {
  const file = formData.get('file') as File
  const testType = formData.get('testType') as TestType // NEW: Get test type

  if (!file) return { success: false, error: 'No file provided' }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    let extracted: ParsedPDFData

    // Route to correct extractor based on test type
    if (testType === '11-panel-lab') {
      const { extract11PanelLab } = await import('@/utilities/extractors/extract11PanelLab')
      extracted = await extract11PanelLab(buffer)
    } else {
      const { extract15PanelInstant } = await import('@/utilities/extractors/extract15PanelInstant')
      extracted = await extract15PanelInstant(buffer)
    }

    return { success: true, data: extracted }
  } catch (error: any) {
    return { success: false, error: `Failed to extract PDF data: ${error.message}` }
  }
}
```

**Estimated:** 30 lines, 30 minutes

---

#### 2.4 Update Confirm Step - Confirmation Preview

**File:** `/src/components/views/PDFUploadWizard/field-groups/ConfirmFieldGroup.tsx`

**Changes:**
Show confirmation data in final summary if present:

```typescript
// After displaying detected substances (around line 95)
{formValues.extractData.hasConfirmation && (
  <div className="space-y-2">
    <h3 className="text-lg font-semibold">Confirmation Results</h3>
    <div className="rounded-md border p-4">
      {formValues.extractData.confirmationResults?.map((result) => (
        <div key={result.substance} className="flex items-center justify-between py-1">
          <span>{formatSubstance(result.substance)}</span>
          <Badge variant={result.result === 'confirmed-positive' ? 'destructive' : 'success'}>
            {result.result}
          </Badge>
        </div>
      ))}
    </div>
    <p className="text-sm text-muted-foreground">
      These confirmation results will be saved to the drug test record.
    </p>
  </div>
)}
```

**Estimated:** 25 lines, 30 minutes

---

### Phase 3: Server Actions Enhancement (2 hours)

#### 3.1 Update Create Drug Test Action

**File:** `/src/components/views/PDFUploadWizard/actions.ts`

**Changes:**
Modify `createDrugTestWithEmailReview` to handle confirmation data:

```typescript
export async function createDrugTestWithEmailReview(data: {
  // ... existing fields
  confirmationResults?: Array<{
    substance: string
    result: string
    notes?: string
  }>
}): Promise<{ success: boolean; testId?: string; error?: string }> {
  const payload = await getPayload({ config })

  try {
    // ... existing PDF upload logic

    // Create drug test with optional confirmation data
    const drugTestData: any = {
      relatedClient: data.clientId,
      testType: data.testType,
      collectionDate: data.collectionDate,
      detectedSubstances: data.detectedSubstances,
      isDilute: data.isDilute,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened',
      processNotes: 'Created via Drug Test Collector wizard with email review',
      sendNotifications: false, // Controlled via wizard
    }

    // Add confirmation data if present
    if (data.confirmationResults && data.confirmationResults.length > 0) {
      drugTestData.confirmationResults = data.confirmationResults
      drugTestData.confirmationDocument = uploadedFile.id // Same PDF contains both
      drugTestData.confirmationDecision = 'request-confirmation' // Triggers workflow
    }

    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: drugTestData,
      context: { skipNotificationHook: true }, // Manual email control
      overrideAccess: true,
    })

    return { success: true, testId: drugTest.id }
  } catch (error: any) {
    // ... existing error handling
  }
}
```

**Estimated:** 30 lines, 1 hour

---

### Phase 4: Testing & Polish (4 hours)

#### 4.1 Unit Tests

**Files:**
- `/src/utilities/extractors/__tests__/extract11PanelLab.test.ts`

**Test Cases:**
```typescript
describe('extract11PanelLab', () => {
  it('should extract screening results only', async () => {
    const buffer = await fs.readFile('fixtures/11-panel-screen-only.pdf')
    const result = await extract11PanelLab(buffer)

    expect(result.testType).toBe('11-panel-lab')
    expect(result.detectedSubstances).toContain('buprenorphine')
    expect(result.hasConfirmation).toBe(false)
    expect(result.confidence).toBe('high')
  })

  it('should extract screening + confirmation results', async () => {
    const buffer = await fs.readFile('fixtures/11-panel-with-confirmation.pdf')
    const result = await extract11PanelLab(buffer)

    expect(result.hasConfirmation).toBe(true)
    expect(result.confirmationResults).toHaveLength(2)
    expect(result.confirmationResults?.[0]).toMatchObject({
      substance: 'amphetamines',
      result: 'confirmed-positive'
    })
  })

  it('should map Mitragynine to kratom', async () => {
    const buffer = await fs.readFile('fixtures/11-panel-with-kratom.pdf')
    const result = await extract11PanelLab(buffer)

    expect(result.detectedSubstances).toContain('kratom')
  })

  it('should handle missing donor name gracefully', async () => {
    const buffer = await fs.readFile('fixtures/11-panel-incomplete.pdf')
    const result = await extract11PanelLab(buffer)

    expect(result.donorName).toBeNull()
    expect(result.confidence).toBe('medium')
  })
})
```

**Estimated:** 100 lines, 2 hours

---

#### 4.2 Integration Testing

**Manual Test Checklist:**

- [ ] Select "11-Panel Lab" test type → upload lab PDF → extraction works
- [ ] Screening-only PDF → no confirmation section shown
- [ ] Screening + confirmation PDF → both sections shown
- [ ] Warning appears if confirmation data in screening workflow
- [ ] Kratom (MIT) substance correctly mapped
- [ ] Client matching works with lab test
- [ ] Drug test created with screening results
- [ ] Drug test created with confirmation results (if present)
- [ ] Email notification sent with correct test type
- [ ] `computeTestResults` hook runs correctly with lab data
- [ ] PDF stored in private-media collection
- [ ] Verify client medications display correctly
- [ ] Test with dilute lab sample
- [ ] Test with negative lab results (all substances negative)

**Edge Cases:**
- PDF with only some substances confirmed
- Missing collection date in PDF
- Client name variations (Jr., Sr., III)
- Very long substance lists
- PDF file size limits (<10MB)

**Estimated:** 2 hours

---

#### 4.3 Error Handling & Polish

**Key Areas:**
1. Loading states during PDF extraction
2. Clear error messages for extraction failures
3. Validation: prevent wrong test type selection
4. Back button handling between steps
5. Success/failure toast notifications
6. Admin alerts for critical failures
7. Confirmation data warning styling

**Estimated:** 1 hour (covered during integration testing)

---

## File Structure (After Implementation)

```
/src/
├── utilities/extractors/
│   ├── extract15PanelInstant.ts        # Existing (instant tests)
│   ├── extract11PanelLab.ts            # NEW (11-panel lab tests)
│   └── __tests__/
│       ├── extract15PanelInstant.test.ts
│       └── extract11PanelLab.test.ts   # NEW
│
├── components/views/PDFUploadWizard/   # To be renamed to DrugTestCollector
│   ├── index.tsx                       # No changes
│   ├── PDFUploadWizardClient.tsx       # No changes (6 steps remain same)
│   ├── types.ts                        # MODIFIED (+20 lines)
│   ├── actions.ts                      # MODIFIED (+60 lines)
│   ├── field-groups/
│   │   ├── UploadFieldGroup.tsx        # MODIFIED (+15 lines) - test type selector
│   │   ├── ExtractFieldGroup.tsx       # MODIFIED (+35 lines) - confirmation display
│   │   ├── VerifyClientFieldGroup.tsx  # No changes
│   │   ├── VerifyDataFieldGroup.tsx    # No changes (already supports all types)
│   │   ├── ConfirmFieldGroup.tsx       # MODIFIED (+25 lines) - confirmation preview
│   │   └── ReviewEmailsFieldGroup.tsx  # No changes
│   └── components/
│       ├── EmailPreviewModal.tsx       # No changes
│       └── RecipientEditor.tsx         # No changes
│
├── fields/
│   └── substanceOptions.ts             # MODIFIED (+1 line) - add Kratom to 11-panel
│
└── collections/DrugTests/
    ├── hooks/
    │   ├── computeTestResults.ts       # No changes (already supports all types)
    │   └── sendNotificationEmails.ts   # No changes (already supports all types)
    └── email/
        └── templates.ts                # No changes (already supports all types)
```

**Summary:**
- **New files:** 2 (extractor + tests)
- **Modified files:** 5 (types, actions, 3 field groups, substance options)
- **Total new lines:** ~350
- **Total modified lines:** ~120

---

## Workflow Comparison

### Instant Test (15-Panel) - Current

```
Upload PDF → Extract → Match Client → Verify Data → Confirm → Review Emails
│            │         │              │             │         │
│            │         │              │             │         └─ Customize emails
│            │         │              │             └─ Final summary
│            │         │              └─ Edit substances, date
│            │         └─ Fuzzy client search
│            └─ extract15PanelInstant()
└─ Select file
```

**Output:** New drug test with `screeningStatus: 'screened'`

---

### Lab Test (11-Panel) - After Implementation

```
Upload PDF → Extract → Match Client → Verify Data → Confirm → Review Emails
│            │         │              │             │         │
│            │         │              │             │         └─ Customize emails
│            │         │              │             └─ Show screening + confirmation
│            │         │              └─ Edit substances, date
│            │         └─ Fuzzy client search
│            └─ extract11PanelLab() (both sections)
└─ Select test type + file
```

**Output:** New drug test with:
- `screeningStatus: 'screened'`
- Optional `confirmationResults` array (if confirmation data present)
- Optional `confirmationDecision: 'request-confirmation'` (if confirmation data present)

---

## Benefits of This Approach

✅ **Minimal Code Changes**
- Only 2 new files, 5 modified files
- Reuses 90% of existing wizard infrastructure
- No architectural changes needed

✅ **Fast to Implement**
- 16 hours total (2 days)
- Low risk to existing functionality
- Easy to test incrementally

✅ **Easy to Rollback**
- If 11-panel doesn't work, rollback in 1 hour
- Existing 15-panel functionality untouched
- No breaking changes

✅ **Natural Extension**
- Same 6-step flow works for both types
- Consistent UX for admins
- Easy to add 17-panel SOS later (12 hours)

✅ **Flexible for Future**
- Can refactor to router page if needed (8 hours)
- Can add more test types with same pattern
- Clear migration path

---

## Future Enhancements (Out of Scope)

### Phase 2: Additional Lab Formats
- **17-Panel SOS Lab** - Create `extract17PanelSOS.ts` (12 hours)
- **EtG Alcohol Test** - Create `extractEtG.ts` (8 hours)

### Phase 3: Workflow Router
If we need 3+ distinct workflows (not just different parsers):
- Create router page with 4 workflow cards (8 hours)
- Separate wizards for Lab Collection, Lab Screening, Lab Confirmation
- Extract shared components for reuse

### Phase 4: Advanced Features
- OCR support for scanned PDFs (requires new dependencies)
- Bulk upload (process multiple PDFs)
- Barcode recognition for client IDs
- Template management for custom PDF formats

---

## Renaming Considerations

### Current Name: "PDF Upload Wizard"
**Issues:**
- Doesn't describe full functionality
- Will handle more than just PDF uploads (manual entry planned)
- "Wizard" is implementation detail, not user benefit

### Proposed Name: "Drug Test Collector"
**Benefits:**
- Describes what it does (collects drug test data)
- Agnostic to data source (PDF, manual, future sources)
- Clear purpose for admins

### Alternative Names:
- "Test Results Importer"
- "Drug Test Processor"
- "Test Data Collector"
- "Results Entry System"

### Renaming Checklist:
- [ ] Rename folder: `PDFUploadWizard` → `DrugTestCollector`
- [ ] Update file imports across codebase
- [ ] Update payload.config.ts custom view registration
- [ ] Update navigation link text
- [ ] Update component display names
- [ ] Update documentation references
- [ ] Update CLAUDE.md references

**Estimated Time:** 1 hour

---

## Key Technical Decisions

### Why Extend Existing Wizard vs. Create Separate Workflows?

**Pros of Extension:**
- Same 6 steps work for both test types
- Minimal code duplication
- Consistent UX for admins
- Fast to implement (16 hours)

**Cons:**
- Less separation of concerns
- Some conditional logic in components
- Harder to add very different workflows later

**Decision:** Extend for now (POC), refactor to separate workflows if needed later.

---

### Why Not Build Router Page Now?

**Reasoning:**
- Only one workflow variation (instant vs. lab, same steps)
- Unclear if we'll need distinct workflows (Lab Collection, Lab Screening, Lab Confirmation)
- Better to wait until patterns emerge from real usage
- Can refactor in 8 hours if needed later

---

### Why Map Confirmation Results to Binary?

**Options:**
1. Store quantitative values (ng/mL) - more data, complex schema
2. Store binary (positive/negative) - simple, consistent with instant tests

**Decision:** Binary for now because:
- `computeTestResults` hook expects binary arrays
- Medication comparison logic expects binary
- Email templates expect binary
- Quantitative values preserved in PDF (authoritative source)
- Can add quantitative storage later if needed

---

## Success Criteria

After implementation, verify:

**Functional:**
- [ ] Admin can select test type (15-panel or 11-panel)
- [ ] 11-panel PDFs parse correctly (>95% accuracy)
- [ ] Screening results extracted accurately
- [ ] Confirmation results extracted (if present)
- [ ] Kratom (MIT) substance correctly mapped
- [ ] Drug test created with all data
- [ ] Emails sent with correct test type
- [ ] No regression in 15-panel workflow

**Quality:**
- [ ] Unit tests pass for 11-panel parser
- [ ] Integration tests pass for full flow
- [ ] Error handling works for edge cases
- [ ] Loading states smooth
- [ ] Clear error messages

**Performance:**
- [ ] Extraction completes in <2 seconds
- [ ] Wizard navigation smooth (no lag)
- [ ] Email generation <1 second

---

## Support & Documentation

### For Admins Using the Drug Test Collector

**15-Panel Instant Test:**
1. Click "Drug Test Collector" in admin nav
2. Select "15-Panel Instant Test"
3. Upload PDF file
4. Review extracted data
5. Verify correct client
6. Adjust fields if needed
7. Review and send emails

**11-Panel Lab Test:**
1. Click "Drug Test Collector" in admin nav
2. Select "11-Panel Lab Test"
3. Upload lab PDF file
4. Review screening results (and confirmation if present)
5. Verify correct client
6. Adjust fields if needed
7. Review and send emails

### For Developers Adding New Test Types

1. Copy `extract11PanelLab.ts` as template
2. Update substance mapping for new format
3. Adapt regex patterns for PDF layout
4. Test with sample PDF
5. Add to test type dropdown
6. Update `extractPdfData` routing in actions.ts

---

## Migration Timeline

### Renaming: "PDF Upload Wizard" → "Drug Test Collector"
**When:** After 11-panel implementation complete
**Why:** Rename once, not twice
**Estimated:** 1 hour

### Refactoring: Monolithic Wizard → Workflow Router
**When:** After 3rd test type OR if workflows diverge significantly
**Why:** Patterns will be clear by then
**Estimated:** 8 hours

---

## Testing Strategy

### Unit Tests
- **Extractor logic** (extract11PanelLab.ts)
  - Screening-only PDFs
  - Screening + confirmation PDFs
  - Substance mapping (including Kratom)
  - Missing fields handling
  - Dilute sample detection

### Integration Tests
- **Full workflow** (end-to-end)
  - Upload → Extract → Create → Email
  - Test both 15-panel and 11-panel paths
  - Verify database state
  - Verify email sending

### Manual Tests
- **Real PDFs** (20 samples minimum)
  - Variety of results (positive, negative, dilute)
  - Different clients
  - Edge cases (missing fields, unclear formatting)

---

## Deployment Checklist

Before deploying to production:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing complete (20+ PDFs)
- [ ] Error handling tested
- [ ] Loading states smooth
- [ ] Email notifications working
- [ ] Admin training complete
- [ ] Documentation updated
- [ ] CLAUDE.md updated
- [ ] Rollback plan tested

---

## Notes

- **First Priority:** 11-panel lab test support (POC)
- **Second Priority:** Rename to "Drug Test Collector" (clarity)
- **Third Priority:** Add 17-panel SOS if needed (extensibility)
- **Future:** Workflow router if workflows diverge (scalability)

---

**Last Updated:** 2025-01-29
**Status:** Implementation Plan - Ready to Execute
**Estimated Completion:** 2 business days (16 hours)
