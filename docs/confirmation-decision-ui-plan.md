# Plan: Add Confirmation Decision UI to Verify-Data Step

## Summary
Add UI to the verify-data step allowing technicians to accept results or request confirmation testing when unexpected positives are detected. Pre-select unexpected positives for confirmation with ability to modify.

## Workflows Affected
- `15-panel-instant`
- `enter-lab-screen`

---

## Implementation Steps

### 1. Extend Schema (`VerifyDataFieldGroup.tsx`:15-28)
Add two new fields to `verifyDataFieldSchema`:
```typescript
confirmationDecision: z.enum(['accept', 'request-confirmation']).nullable().optional(),
confirmationSubstances: z.array(z.string()).optional(),
```

Update `defaultValues` (line 30-36) to include:
```typescript
confirmationDecision: null,
confirmationSubstances: [],
```

### 2. Add Confirmation Decision UI (`VerifyDataFieldGroup.tsx`:46-166)
In the render function:

**A. Import and use existing query hook:**
```typescript
import { useComputeTestResultPreviewQuery } from '../queries'

// Inside render
const detectedSubstances = useStore(group.store, (state) => state.values.detectedSubstances)
const previewQuery = useComputeTestResultPreviewQuery(client?.id, detectedSubstances as SubstanceValue[])
const preview = previewQuery.data
const hasUnexpectedPositives = (preview?.unexpectedPositives?.length ?? 0) > 0
```

**B. Add conditional UI section** (after the test data Card, before closing div):
- Show only when `hasUnexpectedPositives && !preview?.autoAccept`
- Display unexpected positives as badges
- Radio buttons: "Accept Results" / "Request Confirmation Testing"
- When "Request Confirmation" selected, show substance checklist

**C. Auto-populate confirmation substances** via useEffect:
- When `confirmationDecision` changes to `'request-confirmation'`, pre-select all `unexpectedPositives`

### 3. Create ConfirmationSubstanceSelector Component
**File:** `src/blocks/Form/field-components/confirmation-substance-selector.tsx`

Simple checkbox list component:
- Props: `unexpectedPositives`, `selectedSubstances`, `onSelectionChange`
- "Select All" / "Clear" buttons
- Checkbox for each substance
- Counter showing "Selected: X of Y"

### 4. Update Form Submission (`use-pdf-upload-form-opts.ts`)
Pass new fields to `createDrugTestWithEmailReview`:
```typescript
confirmationDecision: value.verifyData.confirmationDecision,
confirmationSubstances: value.verifyData.confirmationSubstances,
```

### 5. Update Server Action (`actions.ts`)
Modify `createDrugTestWithEmailReview` function signature to accept:
```typescript
confirmationDecision?: 'accept' | 'request-confirmation' | null
confirmationSubstances?: string[]
```

When creating drug test, add fields if provided:
```typescript
if (testData.confirmationDecision) {
  drugTestData.confirmationDecision = testData.confirmationDecision
  if (testData.confirmationDecision === 'request-confirmation') {
    drugTestData.confirmationSubstances = testData.confirmationSubstances
  }
}
```

### 6. Update EnterLabScreenWorkflow
**File:** `src/components/views/PDFUploadWizard/workflows/EnterLabScreenWorkflow.tsx`

- Add new fields to defaultValues
- Pass to `updateTestWithScreening` action

### 7. Update `updateTestWithScreening` Action
Add same confirmation fields handling as step 5.

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `src/components/views/PDFUploadWizard/field-groups/VerifyDataFieldGroup.tsx` | Schema, default values, confirmation decision UI |
| `src/blocks/Form/field-components/confirmation-substance-selector.tsx` | New component (create) |
| `src/components/views/PDFUploadWizard/use-pdf-upload-form-opts.ts` | Pass new fields on submit |
| `src/components/views/PDFUploadWizard/actions.ts` | Update server actions |
| `src/components/views/PDFUploadWizard/workflows/EnterLabScreenWorkflow.tsx` | Add new fields to workflow |

---

## Edge Cases
1. **No unexpected positives** - Hide confirmation decision UI entirely
2. **Auto-accept scenarios** - Skip decision UI (negative/expected-positive only)
3. **User deselects all substances** - Require at least one if requesting confirmation
4. **PDF has embedded confirmation** - When `extractData.hasConfirmation` is true, skip (already has results)
