# PDF Upload Wizard Refactor: TanStack Form Migration

## Overview
Refactor the PDF Upload Wizard from useState-based step navigation to TanStack Form with field groups, following the registration form pattern and TanStack Form composition best practices.

## Architecture

### 1. Form Structure
- **Main Component**: `PDFUploadWizardClient.tsx` (refactored)
  - Use `useAppForm` with form options hook
  - Use `useFormStepper` for step navigation
  - Progress bar UI similar to registration form
  - 5 steps with schemas for validation

### 2. Custom Field Components (in `src/blocks/Form/field-components/`)
Following TanStack Form composition pattern, create reusable field components:

**`file-upload-field.tsx`** (NEW)
- Reusable file upload field component
- Integrates with existing FileUpload UI components
- Configurable validation (file types, size limits)
- Returns File object

**`parsed-data-display-field.tsx`** (NEW)
- Displays extracted PDF data with confidence levels
- Shows donor name, collection date, substances, dilute status
- Expandable raw text view
- Read-only field for review

**`client-selector-field.tsx`** (NEW)
- Client matching and selection UI
- Handles exact matches, fuzzy matches, dropdown fallback
- Displays client info cards with match scores
- Returns ClientMatch object

**`substance-checklist-field.tsx`** (NEW)
- Multi-select checkboxes for detected substances
- Uses panel15InstantSubstances options
- Shows selected count
- Useful beyond just PDF wizard

**`medication-display-field.tsx`** (NEW)
- Read-only display of client medications
- Shows expected positive substances
- Alert-style component
- Reusable for other drug test views

### 3. Field Groups (in `src/components/views/PDFUploadWizard/field-groups/`)
Convert each step to a field group using the custom field components:

**`UploadFieldGroup.tsx`**
- Uses `FileUploadField` component
- Validation: PDF only, max 10MB
- Stores File in form state

**`ExtractFieldGroup.tsx`**
- Auto-runs `extractPdfData` server action on mount
- Uses `ParsedDataDisplayField` to show results
- Loading state during extraction
- Stores ParsedPDFData in form state

**`VerifyClientFieldGroup.tsx`**
- Auto-runs `findMatchingClients` on mount
- Uses `ClientSelectorField` for selection
- Loading state during search
- Stores ClientMatch in form state

**`VerifyDataFieldGroup.tsx`**
- Uses `SelectField` for test type
- Uses existing `InputDateTimePicker` component
- Uses `SubstanceChecklistField` for substances
- Uses `CheckboxField` for dilute flag
- Uses `MedicationDisplayField` to show client meds
- Stores VerifiedTestData in form state

**`ConfirmFieldGroup.tsx`**
- Read-only summary using display components
- Auto-computes test result preview
- Final confirmation before submission

### 4. Form Options Hook
**`use-pdf-upload-form-opts.ts`** (NEW in PDFUploadWizard dir)
- Default values for all field groups
- `onSubmit` handler calls `createDrugTest` server action
- Error handling with toast notifications
- Redirects to created drug test on success

### 5. Schemas
**`schemas/pdfUploadSchemas.ts`** (NEW in PDFUploadWizard dir)
- Zod schema for each step
- File validation for upload step
- Client selection validation
- Export `stepSchemas` array for useFormStepper

### 6. Types
**`types.ts`** (UPDATED in PDFUploadWizard dir)
- Add form-specific types for TanStack Form state
- Preserve existing types (ParsedPDFData, ClientMatch, etc.)

### 7. Register New Field Components
**`src/blocks/Form/hooks/form.tsx`** (UPDATED)
- Import and register new field components
- Add to fieldComponents object in createFormHook

## Key Implementation Details

### File Handling
- Store File object directly in form state (uploadData.file)
- Convert to buffer array in onSubmit for server action

### Automatic Progression
- ExtractFieldGroup and VerifyClientFieldGroup auto-run server actions in useEffect
- Show loading states during processing
- User must still click "Next" to advance after review

### Data Flow
```
Step 1 (Upload): file → uploadData { file: File }
Step 2 (Extract): ParsedPDFData → extractData { ...ParsedPDFData }
Step 3 (Client): ClientMatch → clientData { ...ClientMatch }
Step 4 (Verify): VerifiedTestData → verifyData { testType, collectionDate, detectedSubstances, isDilute }
Step 5 (Confirm): All data → onSubmit → createDrugTest
```

### Future Email Review Step
- Architecture supports adding 6th step after confirm
- Can insert in field groups and add to stepSchemas array

## Files to Create

### Field Components (reusable, in blocks/Form/field-components/)
1. `src/blocks/Form/field-components/file-upload-field.tsx`
2. `src/blocks/Form/field-components/parsed-data-display-field.tsx`
3. `src/blocks/Form/field-components/client-selector-field.tsx`
4. `src/blocks/Form/field-components/substance-checklist-field.tsx`
5. `src/blocks/Form/field-components/medication-display-field.tsx`

### Field Groups (view-specific, in PDFUploadWizard/)
6. `src/components/views/PDFUploadWizard/field-groups/UploadFieldGroup.tsx`
7. `src/components/views/PDFUploadWizard/field-groups/ExtractFieldGroup.tsx`
8. `src/components/views/PDFUploadWizard/field-groups/VerifyClientFieldGroup.tsx`
9. `src/components/views/PDFUploadWizard/field-groups/VerifyDataFieldGroup.tsx`
10. `src/components/views/PDFUploadWizard/field-groups/ConfirmFieldGroup.tsx`

### Form Configuration
11. `src/components/views/PDFUploadWizard/use-pdf-upload-form-opts.ts`
12. `src/components/views/PDFUploadWizard/schemas/pdfUploadSchemas.ts`

## Files to Modify
1. `src/components/views/PDFUploadWizard/PDFUploadWizardClient.tsx` - Refactor to use TanStack Form
2. `src/components/views/PDFUploadWizard/types.ts` - Add form state types
3. `src/blocks/Form/hooks/form.tsx` - Register new field components

## Files to Delete (After Refactor)
1. `src/components/views/PDFUploadWizard/steps/UploadStep.tsx`
2. `src/components/views/PDFUploadWizard/steps/ExtractStep.tsx`
3. `src/components/views/PDFUploadWizard/steps/VerifyClientStep.tsx`
4. `src/components/views/PDFUploadWizard/steps/VerifyDataStep.tsx`
5. `src/components/views/PDFUploadWizard/steps/ConfirmStep.tsx`

## Benefits
- ✅ Follows TanStack Form composition pattern correctly
- ✅ Custom field components are reusable across entire app
- ✅ Consistent multi-step form pattern
- ✅ Form state persists between steps automatically
- ✅ Validation handled by Zod schemas
- ✅ Field components can be used in other drug test views
- ✅ Easier to add email review step later
- ✅ Better type safety with TanStack Form
- ✅ Simplified state management

## Decision Log

### User Choices Made During Planning

1. **Step Flow**: Keep automatic progression where it makes sense
   - ExtractStep and VerifyClientStep continue to auto-run server actions
   - User must click Next to proceed after review

2. **Component Structure**: Convert to field groups (like registration)
   - Each step becomes a field group component with TanStack Form fields
   - More consistent with registration pattern

3. **File Handling**: Store File in form state
   - Add a custom file field to TanStack Form state
   - Simple approach, File objects stored directly

4. **Email Step Timing**: After confirm step (6th step)
   - Test is created first, then email review happens
   - Allows reviewing what was actually sent

5. **Field Component Location**: Maintain blocks/Form/field-components/ structure
   - Follows TanStack Form composition best practices
   - Makes components reusable across entire application
