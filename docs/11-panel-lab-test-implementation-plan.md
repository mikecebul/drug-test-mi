# 11-Panel Lab Test Implementation Plan

**Feature:** Add 11-Panel Lab Test Support to Drug Test Collector
**Approach:** Pragmatic - Extend existing wizard with lab test support
**Estimated Time:** 16 hours (2 business days)
**Status:** Ready for Implementation

---

## Quick Reference

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 1 | Create 11-panel PDF parser | 6 hours | High |
| 1 | Update substance options (add Kratom) | 5 min | High |
| 1 | Extend type definitions | 15 min | High |
| 2 | Add test type selector to upload step | 30 min | High |
| 2 | Conditional confirmation display in extract step | 45 min | High |
| 2 | Router logic in server actions | 30 min | High |
| 2 | Confirmation preview in confirm step | 30 min | Medium |
| 3 | Update create action for confirmation data | 1 hour | High |
| 4 | Write unit tests | 2 hours | High |
| 4 | Integration testing | 2 hours | High |
| 4 | Error handling & polish | 1 hour | Medium |
| **Total** | | **16 hours** | |

---

## Executive Summary

### Problem
Current Drug Test Collector only supports 15-panel instant tests. Need to add support for 11-panel lab tests which have different PDF format and include confirmation testing results.

### Solution
Extend existing 6-step wizard with:
1. Test type selector (15-panel instant vs. 11-panel lab)
2. New PDF parser for 11-panel lab format
3. Conditional UI for displaying confirmation results
4. Router logic to direct to correct parser

### Key Benefits
- ✅ Reuses 90% of existing code
- ✅ Ships in 2 days (vs. 3-5 weeks for full refactor)
- ✅ Easy to rollback if needed (1 hour)
- ✅ Natural path to add more test types later
- ✅ Minimal risk to existing functionality

---

## Implementation Phases

### Phase 1: Foundation (4 hours)

#### Task 1.1: Create 11-Panel Lab PDF Parser (6 hours)

**File:** `/src/utilities/extractors/extract11PanelLab.ts`

**Purpose:**
Parse Redwood Toxicology 11-panel lab PDFs and extract:
- Donor name and collection date
- Screening results (Screen column: Negative/Screened Positive)
- Confirmation results (Confirmation column: LC-MS/MS)
- Dilute sample flag
- Test type auto-detection

**Substance Mapping:**
```typescript
{
  'AMP': 'amphetamines',      // Amphetamines
  'BUP': 'buprenorphine',     // Buprenorphine
  'BZO': 'benzodiazepines',   // Benzodiazepines
  'COC': 'cocaine',           // Cocaine
  'ETG': 'etg',               // Ethyl Glucuronide (Alcohol)
  'FEN': 'fentanyl',          // Fentanyl
  'MIT': 'kratom',            // Mitragynine (Kratom) - NEW
  'MTD': 'methadone',         // Methadone
  'OPI': 'opiates',           // Opiates
  'THC': 'thc',               // THC (Marijuana)
}
```

**Return Interface:**
```typescript
interface Extracted11PanelData {
  // Standard fields
  donorName: string | null
  collectionDate: Date | null
  detectedSubstances: SubstanceValue[]  // From Screen column
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  extractedFields: string[]

  // Lab-specific fields
  testType: '11-panel-lab'
  hasConfirmation: boolean
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
  }>
}
```

**Implementation Notes:**
- Use pdf2json library (already installed)
- Parse both "Screen" and "Confirmation" columns
- Map substance abbreviations (AMP, BUP, etc.) to system values
- Detect dilute samples (check for "dilute" keyword)
- Set confidence based on extracted fields
- Handle partial extraction gracefully

**Testing:**
- Unit tests with 3 sample PDFs (screening-only, screening+confirmation, edge cases)
- Verify Kratom/MIT mapping
- Verify confidence scoring
- Handle missing fields

**Estimated Lines:** 250

---

#### Task 1.2: Update Substance Options (5 minutes)

**File:** `/src/fields/substanceOptions.ts`

**Change:**
Add Kratom to `panel11LabSubstances` array (line 64):

```typescript
{ label: 'Kratom (MIT)', value: 'kratom' },
```

**Estimated Lines:** 1

---

#### Task 1.3: Extend Type Definitions (15 minutes)

**File:** `/src/components/views/PDFUploadWizard/types.ts`

**Change:**
Add optional lab-specific fields to `ParsedPDFData` interface:

```typescript
export interface ParsedPDFData {
  // Existing fields...
  donorName: string | null
  collectionDate: Date | null
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  extractedFields: string[]

  // NEW: Lab-specific fields
  testType?: TestType
  hasConfirmation?: boolean
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
}
```

**Estimated Lines:** 15

---

### Phase 2: Wizard Integration (4 hours)

#### Task 2.1: Add Test Type Selector (30 minutes)

**File:** `/src/components/views/PDFUploadWizard/field-groups/UploadFieldGroup.tsx`

**Change:**
Add test type dropdown BEFORE file upload:

```typescript
<form.Field
  name="uploadData.testType"
  defaultValue="15-panel-instant"
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

**Location:** Around line 60 (before file input)

**Estimated Lines:** 15

---

#### Task 2.2: Conditional Confirmation Display (45 minutes)

**File:** `/src/components/views/PDFUploadWizard/field-groups/ExtractFieldGroup.tsx`

**Changes:**
1. Show confirmation section if `hasConfirmation === true`
2. Display warning if confirmation data found in wrong workflow

```typescript
{extractedData.hasConfirmation && (
  <Alert variant="info">
    <AlertTitle>Confirmation Data Detected</AlertTitle>
    <AlertDescription>
      This PDF contains confirmation testing results:
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
```

**Location:** After detected substances display (around line 120)

**Estimated Lines:** 35

---

#### Task 2.3: Parser Routing in Server Actions (30 minutes)

**File:** `/src/components/views/PDFUploadWizard/actions.ts`

**Change:**
Route to correct parser based on test type:

```typescript
export async function extractPdfData(formData: FormData) {
  const file = formData.get('file') as File
  const testType = formData.get('testType') as TestType

  if (!file) return { success: false, error: 'No file provided' }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    let extracted: ParsedPDFData

    // Route based on test type
    if (testType === '11-panel-lab') {
      const { extract11PanelLab } = await import('@/utilities/extractors/extract11PanelLab')
      extracted = await extract11PanelLab(buffer)
    } else {
      const { extract15PanelInstant } = await import('@/utilities/extractors/extract15PanelInstant')
      extracted = await extract15PanelInstant(buffer)
    }

    return { success: true, data: extracted }
  } catch (error: any) {
    return { success: false, error: `Failed to extract PDF: ${error.message}` }
  }
}
```

**Location:** Modify existing `extractPdfData` function

**Estimated Lines:** 30

---

#### Task 2.4: Confirmation Preview (30 minutes)

**File:** `/src/components/views/PDFUploadWizard/field-groups/ConfirmFieldGroup.tsx`

**Change:**
Show confirmation results in final summary:

```typescript
{formValues.extractData.hasConfirmation && (
  <div className="space-y-2">
    <h3 className="text-lg font-semibold">Confirmation Results</h3>
    <div className="rounded-md border p-4">
      {formValues.extractData.confirmationResults?.map((result) => (
        <div key={result.substance} className="flex justify-between py-1">
          <span>{formatSubstance(result.substance)}</span>
          <Badge variant={result.result === 'confirmed-positive' ? 'destructive' : 'success'}>
            {result.result}
          </Badge>
        </div>
      ))}
    </div>
  </div>
)}
```

**Location:** After detected substances section (around line 95)

**Estimated Lines:** 25

---

### Phase 3: Server Actions Enhancement (2 hours)

#### Task 3.1: Update Create Drug Test Action (1 hour)

**File:** `/src/components/views/PDFUploadWizard/actions.ts`

**Change:**
Modify `createDrugTestWithEmailReview` to handle confirmation data:

```typescript
export async function createDrugTestWithEmailReview(data: {
  // ... existing params
  confirmationResults?: Array<{
    substance: string
    result: string
    notes?: string
  }>
}) {
  // ... existing PDF upload logic

  const drugTestData: any = {
    relatedClient: data.clientId,
    testType: data.testType,
    collectionDate: data.collectionDate,
    detectedSubstances: data.detectedSubstances,
    isDilute: data.isDilute,
    testDocument: uploadedFile.id,
    screeningStatus: 'screened',
    processNotes: 'Created via Drug Test Collector with email review',
    sendNotifications: false,
  }

  // Add confirmation data if present
  if (data.confirmationResults && data.confirmationResults.length > 0) {
    drugTestData.confirmationResults = data.confirmationResults
    drugTestData.confirmationDocument = uploadedFile.id
    drugTestData.confirmationDecision = 'request-confirmation'
  }

  const drugTest = await payload.create({
    collection: 'drug-tests',
    data: drugTestData,
    context: { skipNotificationHook: true },
    overrideAccess: true,
  })

  // ... existing email logic
}
```

**Location:** Modify existing function

**Estimated Lines:** 30

---

### Phase 4: Testing & Polish (4 hours)

#### Task 4.1: Unit Tests (2 hours)

**File:** `/src/utilities/extractors/__tests__/extract11PanelLab.test.ts`

**Test Cases:**
```typescript
describe('extract11PanelLab', () => {
  it('extracts screening results only')
  it('extracts screening + confirmation results')
  it('maps Mitragynine to kratom')
  it('handles missing donor name gracefully')
  it('detects dilute samples')
  it('sets confidence score correctly')
})
```

**Estimated Lines:** 100

---

#### Task 4.2: Integration Testing (2 hours)

**Manual Test Checklist:**
- [ ] Select 11-panel test type → upload works
- [ ] Screening-only PDF → extracts correctly
- [ ] Screening + confirmation PDF → shows both sections
- [ ] Kratom substance correctly mapped
- [ ] Client matching works
- [ ] Drug test created with screening results
- [ ] Drug test created with confirmation results
- [ ] Email sent with correct test type
- [ ] computeTestResults hook runs correctly
- [ ] PDF stored in private-media
- [ ] No regression in 15-panel workflow

---

#### Task 4.3: Error Handling & Polish (covered in integration)

**Focus Areas:**
- Loading states during extraction
- Clear error messages
- Validation for test type selection
- Warning display for confirmation data
- Success/failure toast notifications

---

## File Changes Summary

### New Files (2)

| File | Lines | Purpose |
|------|-------|---------|
| `/src/utilities/extractors/extract11PanelLab.ts` | 250 | 11-panel PDF parser |
| `/src/utilities/extractors/__tests__/extract11PanelLab.test.ts` | 100 | Unit tests |

**Total New:** 350 lines

---

### Modified Files (5)

| File | Lines Added | Purpose |
|------|-------------|---------|
| `/src/components/views/PDFUploadWizard/types.ts` | +15 | Add lab-specific fields |
| `/src/components/views/PDFUploadWizard/actions.ts` | +60 | Parser routing + confirmation handling |
| `/src/components/views/PDFUploadWizard/field-groups/UploadFieldGroup.tsx` | +15 | Test type selector |
| `/src/components/views/PDFUploadWizard/field-groups/ExtractFieldGroup.tsx` | +35 | Confirmation display |
| `/src/components/views/PDFUploadWizard/field-groups/ConfirmFieldGroup.tsx` | +25 | Confirmation preview |
| `/src/fields/substanceOptions.ts` | +1 | Add Kratom |

**Total Modified:** ~150 lines

---

## Success Criteria

### Functional Requirements
- [ ] Admin can select test type (15-panel or 11-panel)
- [ ] 11-panel PDFs parse with >95% accuracy
- [ ] Screening results extracted correctly
- [ ] Confirmation results extracted (if present)
- [ ] Kratom (MIT) correctly mapped to 'kratom'
- [ ] Drug test created with all data
- [ ] Emails sent with correct test type
- [ ] No regression in 15-panel workflow

### Quality Requirements
- [ ] Unit tests pass (>90% coverage for parser)
- [ ] Integration tests pass (all manual checklist items)
- [ ] Error handling works for edge cases
- [ ] Loading states smooth
- [ ] Clear error messages for failures

### Performance Requirements
- [ ] PDF extraction completes in <2 seconds
- [ ] Wizard navigation smooth (no lag)
- [ ] Email generation <1 second

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| PDF format varies between labs | High | Build flexible regex patterns, test with 20+ samples |
| Extraction accuracy low (<95%) | High | Extensive testing, fallback to manual entry |
| Confirmation section unclear | Medium | Make confirmation optional, admin can verify |
| Regression in 15-panel workflow | Medium | Test existing workflow before/after changes |
| Direction changes mid-implementation | Low | Low investment (16 hours), easy rollback (1 hour) |

---

## Rollback Plan

If 11-panel doesn't work or direction changes:

**Time Required:** 1 hour

**Steps:**
1. Delete `/src/utilities/extractors/extract11PanelLab.ts`
2. Delete `/src/utilities/extractors/__tests__/extract11PanelLab.test.ts`
3. Revert changes to 5 modified files (git checkout)
4. Test 15-panel workflow still works
5. Deploy

**What's Preserved:**
- All existing 15-panel functionality intact
- No database schema changes
- No breaking changes to API
- Test type selector remains (doesn't hurt)

---

## Future Extensions

### Phase 2: Additional Lab Formats (After 11-Panel Success)

**17-Panel SOS Lab** (12 hours):
1. Copy `extract11PanelLab.ts` → `extract17PanelSOS.ts`
2. Update substance mapping for 17-panel
3. Adapt regex patterns for SOS format
4. Add to test type dropdown
5. Update parser routing

**EtG Alcohol Test** (8 hours):
1. Create `extractEtG.ts` (simpler format, single substance)
2. Add to test type dropdown
3. Update parser routing

### Phase 3: Workflow Router (If Needed)

**When:** After 3+ test types OR workflows diverge significantly

**What:**
- Create router page with workflow selection cards
- Separate wizards for distinct workflows (Lab Collection, Lab Screening, Lab Confirmation)
- Extract shared components

**Estimated:** 8 hours

---

## Developer Notes

### PDF Parsing Tips
- Use pdf2json's event-based API for streaming
- Text may be scrambled - use multiple regex strategies
- Always provide fallback for missing fields
- Set confidence score based on extracted fields
- Test with real PDFs early and often

### Testing Strategy
- Start with unit tests for parser (TDD approach)
- Use real PDF samples from Redwood Toxicology
- Test edge cases: missing fields, unclear formatting, dilute samples
- Manual testing with 20+ real PDFs before production

### Code Review Checklist
- [ ] Parser handles missing fields gracefully
- [ ] Substance mapping complete (all 10 substances)
- [ ] Confidence scoring accurate
- [ ] Error messages clear and actionable
- [ ] Loading states smooth
- [ ] No hardcoded values (use constants)
- [ ] TypeScript types correct
- [ ] Unit tests comprehensive

---

## Timeline

### Day 1 (8 hours)
- Morning: Create 11-panel parser (4 hours)
- Afternoon: Update substance options, extend types, add test selector (1 hour)
- Late Afternoon: Conditional confirmation display (1 hour)
- End of Day: Parser routing in actions (1 hour)
- Evening: Write unit tests (1 hour)

### Day 2 (8 hours)
- Morning: Confirmation preview, update create action (2 hours)
- Mid-Morning: Run unit tests, fix bugs (1 hour)
- Afternoon: Integration testing with real PDFs (3 hours)
- Late Afternoon: Error handling, polish (1 hour)
- End of Day: Final testing, documentation (1 hour)

**Total: 16 hours over 2 business days**

---

## Questions & Answers

**Q: Why not create separate workflows for Lab Collection, Lab Screening, Lab Confirmation?**
A: Those are future workflows (Phase 3). This POC focuses on supporting 11-panel PDF format first. Once validated, we can add separate workflows.

**Q: Why map confirmation results to binary (positive/negative) instead of storing quantitative values?**
A: Consistency with existing system. The `computeTestResults` hook expects binary arrays. Quantitative values are preserved in PDF (authoritative source). Can add later if needed.

**Q: What if we need to add 17-panel SOS later?**
A: Copy `extract11PanelLab.ts`, update substance mapping, add to dropdown. Estimated 12 hours.

**Q: What if direction changes and we need a completely different approach?**
A: Rollback in 1 hour (delete 2 files, revert 5 files). Low investment, low risk.

---

## Support Contacts

**Technical Questions:** Development team
**PDF Samples:** Redwood Toxicology lab
**Testing Assistance:** Admin staff
**Deployment:** DevOps team

---

**Created:** 2025-01-29
**Last Updated:** 2025-01-29
**Status:** Ready for Implementation
**Next Steps:** Begin Phase 1 - Create 11-panel parser
