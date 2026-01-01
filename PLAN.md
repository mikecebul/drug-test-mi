# Lab-Screen Workflow Refactoring Implementation Plan

## Overview
Refactor the lab-screen workflow from the old `EnterLabScreenWorkflow.tsx` to match the new pattern established in `instant-test`, `collect-lab`, and `register-client` workflows.

## Key Requirements
- **Step naming**: Use `matchCollection` and `labScreenData` (more declarative names)
- **No medications step**: Medications come from the matched test's client (display only in verify/confirm steps)
- **No localStorage**: Unlike instant-test, this workflow doesn't need cross-workflow file persistence
- **Reuse pattern**: Follow instant-test workflow structure with withForm() for steps
- **Validation**: Keep all validation at form level (validators.ts), never at field level
- **Grouping**: All workflow files (steps, components, actions) live in dedicated workflow folder

## Current State Analysis

### ✅ What Exists
1. `workflows/lab-screen/Workflow.tsx` - Main orchestration (has issues)
2. `workflows/lab-screen/shared-form.ts` - Form config (needs fixes)
3. `workflows/lab-screen/validators.ts` - Step schemas (needs updates)

### ❌ What's Missing
1. **Folders**: `steps/`, `components/`, `actions/`
2. **Steps**: Upload, Extract, MatchCollection, LabScreenData, Confirm, Emails (6 total)
3. **Components**: Navigation.tsx
4. **Actions**: updateLabScreen.ts (wrapper around existing updateTestWithScreening)

### 🔧 What Needs Fixing

#### Issue 1: Workflow.tsx
- **Problem**: Component named `InstantTestWorkflow` (copy-paste error)
- **Fix**: Rename to `LabScreenWorkflow`
- **Problem**: References non-existent imports and localStorage utilities
- **Fix**: Update imports once files are created, remove localStorage references
- **Problem**: Has 7 steps including 'medications'
- **Fix**: Remove medications step, use 6 steps total

#### Issue 2: shared-form.ts
- **Problem**: Function named `getInstantTestFormOpts`
- **Fix**: Rename to `getLabScreenFormOpts`
- **Problem**: Has medications in defaultValues
- **Fix**: Remove medications field
- **Problem**: Step validation references 'screenData' instead of 'labScreenData'
- **Fix**: Update to use 'labScreenData' consistently

#### Issue 3: validators.ts
- **Problem**: Has 'medications' step in steps array
- **Fix**: Remove from steps array (should be 6 steps)
- **Problem**: Imports medicationsSchema but doesn't use it
- **Fix**: Remove medicationsSchema import and from formSchema

## Implementation Steps

### Phase 1: Fix Existing Files

#### 1.1 Fix validators.ts
**File**: `workflows/lab-screen/validators.ts`

**Changes**:
```typescript
// Update steps array (remove 'medications')
export const steps = ['upload', 'extract', 'matchCollection', 'labScreenData', 'confirm', 'emails'] as const

// Remove medicationsSchema import
import { emailsSchema, uploadSchema, extractSchema } from '../shared-validators'

// Rename collectionSchema to matchCollectionSchema
export const matchCollectionSchema = z.object({
  matchCollection: z.object({
    testId: z.string().min(1, 'Test selection is required'),
    clientName: z.string().min(1),
    testType: z.string().min(1),
    collectionDate: z.string().min(1),
    screeningStatus: z.string().min(1),
    matchType: z.enum(['exact', 'fuzzy', 'manual']),
    score: z.number().min(0).max(100),
  }),
})

// Update formSchema (remove medicationsSchema)
export const formSchema = z.object({
  ...uploadSchema.shape,
  ...extractSchema.shape,
  ...matchCollectionSchema.shape,
  ...labScreenDataSchema.shape,
  ...emailsSchema.shape,
})
```

#### 1.2 Fix shared-form.ts
**File**: `workflows/lab-screen/shared-form.ts`

**Changes**:
```typescript
// Update imports
import {
  FormValues,
  steps,
  formSchema,
  uploadSchema,
  extractSchema,
  matchCollectionSchema,
  labScreenDataSchema,
  emailsSchema,
  type Steps,
} from './validators'

// Update defaultValues (remove medications, rename collection -> matchCollection)
const defaultValues: FormValues = {
  upload: {
    file: null as any,
  },
  extract: {
    extracted: false,
  },
  matchCollection: {
    testId: '',
    clientName: '',
    testType: '',
    collectionDate: '',
    screeningStatus: '',
    matchType: 'manual' as const,
    score: 0,
  },
  labScreenData: {
    testType: '11-panel-lab' as const,
    collectionDate: new Date().toISOString(),
    detectedSubstances: [],
    isDilute: false,
    breathalyzerTaken: false,
    breathalyzerResult: null,
    confirmationDecision: null,
    confirmationSubstances: [],
  },
  emails: {
    clientEmailEnabled: false, // Default false for lab tests (results not immediate)
    clientRecipients: [],
    referralEmailEnabled: true,
    referralRecipients: [],
  },
}

// Rename function
export const labScreenFormOpts = formOptions({
  defaultValues,
})

export const getLabScreenFormOpts = (step: Steps[number]) =>
  formOptions({
    defaultValues,
    validators: {
      onSubmit: ({ formApi }) => {
        if (step === 'upload') {
          return formApi.parseValuesWithSchema(uploadSchema as typeof formSchema)
        }
        if (step === 'extract') {
          return formApi.parseValuesWithSchema(extractSchema as typeof formSchema)
        }
        if (step === 'matchCollection') {
          return formApi.parseValuesWithSchema(matchCollectionSchema as typeof formSchema)
        }
        if (step === 'labScreenData') {
          return formApi.parseValuesWithSchema(labScreenDataSchema as typeof formSchema)
        }
        if (step === 'confirm') {
          return undefined // No validation on confirm step
        }
        if (step === 'emails') {
          return formApi.parseValuesWithSchema(emailsSchema as typeof formSchema)
        }
      },
    },
  })
```

#### 1.3 Fix Workflow.tsx
**File**: `workflows/lab-screen/Workflow.tsx`

**Changes**:
1. Rename component: `InstantTestWorkflow` → `LabScreenWorkflow`
2. Update props interface: `InstantTestWorkflowProps` → `LabScreenWorkflowProps`
3. Remove localStorage imports and references
4. Update imports to use correct file paths (once created)
5. Remove medications step from step rendering
6. Update form submission to call correct action
7. Update steps array to match validators (6 steps)

**Key sections to update**:
```typescript
export function LabScreenWorkflow({ onBack }: LabScreenWorkflowProps) {
  // Use correct form opts
  const form = useAppForm({
    ...getLabScreenFormOpts(currentStep),
    onSubmit: async ({ value }) => {
      if (isLastStep) {
        // Call lab screen specific action
        const result = await updateLabScreenAction(/* ... */)
      }
    },
  })

  // Update step rendering (remove medications case)
  const renderStep = () => {
    switch (currentStep) {
      case 'upload': return <UploadStep form={form} />
      case 'extract': return <ExtractStep form={form} />
      case 'matchCollection': return <MatchCollectionStep form={form} />
      case 'labScreenData': return <LabScreenDataStep form={form} />
      case 'confirm': return <ConfirmStep form={form} />
      case 'emails': return <EmailsStep form={form} />
    }
  }
}
```

### Phase 2: Create Directory Structure

```
workflows/lab-screen/
├── Workflow.tsx                    (fix existing)
├── shared-form.ts                  (fix existing)
├── validators.ts                   (fix existing)
├── components/
│   └── Navigation.tsx              (create new)
├── steps/
│   ├── Upload.tsx                  (create new)
│   ├── Extract.tsx                 (create new)
│   ├── MatchCollection.tsx         (create new - convert VerifyTestFieldGroup)
│   ├── LabScreenData.tsx           (create new - convert VerifyDataFieldGroup)
│   ├── confirm/
│   │   ├── Step.tsx                (create new - convert TestSummaryFieldGroup)
│   │   └── components/
│   │       └── index.ts            (create new - if complex helpers needed)
│   └── Emails.tsx                  (create new - reuse EmailsFieldGroup)
└── actions/
    └── updateLabScreen.ts          (create new)
```

### Phase 3: Create Step Components

#### 3.1 Upload Step
**File**: `steps/Upload.tsx`
**Pattern**: Simple PDF upload field

```typescript
'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getLabScreenFormOpts } from '../shared-form'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'

export const UploadStep = withForm({
  ...getLabScreenFormOpts('upload'),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Upload Lab Screening Results PDF"
          description="Upload the PDF report from the laboratory"
        />
        <form.AppField name="upload.file">
          {(field) => (
            <field.FileUploadField
              accept="application/pdf"
              maxFiles={1}
              maxSize={10 * 1024 * 1024}
              required
            />
          )}
        </form.AppField>
      </div>
    )
  },
})
```

#### 3.2 Extract Step
**File**: `steps/Extract.tsx`
**Pattern**: Copy from instant-test, adjust for lab screen (11-panel-lab)

```typescript
'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileX2 } from 'lucide-react'
import ParsedDataDisplayField from '@/blocks/Form/field-components/parsed-data-display-field'
import type { ParsedPDFData } from '@/views/PDFUploadWizard/types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { useExtractPdfQuery } from '@/views/PDFUploadWizard/queries'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { wizardContainerStyles } from '@/views/PDFUploadWizard/styles'
import { getLabScreenFormOpts } from '../shared-form'

export const ExtractStep = withForm({
  ...getLabScreenFormOpts('extract'),

  render: function Render({ form }) {
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)
    const { data: extractedData, isLoading, error } = useExtractPdfQuery(uploadedFile, '11-panel-lab')

    // Auto-sync extracted data to form when available
    useEffect(() => {
      if (extractedData) {
        form.setFieldValue('extract.extracted', true)
        // Pre-populate labScreenData with extracted values
        if (extractedData.collectionDate) {
          form.setFieldValue('labScreenData.collectionDate', extractedData.collectionDate)
        }
        if (extractedData.detectedSubstances) {
          form.setFieldValue('labScreenData.detectedSubstances', extractedData.detectedSubstances)
        }
        if (extractedData.isDilute !== undefined) {
          form.setFieldValue('labScreenData.isDilute', extractedData.isDilute)
        }
      }
    }, [extractedData, form])

    // Loading, error, and success states (same pattern as instant-test)
    if (isLoading) {
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Extracting Data..." description="Processing your PDF file" />
          <Card className={wizardContainerStyles.card}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <div className="space-y-4 text-center">
                  <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
                  <p className="text-muted-foreground text-lg">Please wait while we extract the test data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Extraction Failed" description="Unable to process the PDF file" />
          <Alert variant="destructive">
            <FileX2 className="h-4 w-4" />
            <AlertDescription>
              <p className="mb-1 text-base font-medium">{errorMessage}</p>
              <p className="text-sm">
                The PDF format may not be supported, or the file may be damaged.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    if (!extractedData) {
      return (
        <div className={wizardContainerStyles.content}>
          <FieldGroupHeader title="No Data" description="No file uploaded. Please go back." />
        </div>
      )
    }

    // Build ParsedPDFData object for display
    const parsedData: ParsedPDFData = {
      donorName: extractedData.donorName,
      collectionDate: extractedData.collectionDate,
      detectedSubstances: extractedData.detectedSubstances as SubstanceValue[],
      isDilute: extractedData.isDilute,
      rawText: extractedData.rawText,
      confidence: extractedData.confidence,
      extractedFields: extractedData.extractedFields,
      testType: extractedData.testType,
      hasConfirmation: extractedData.hasConfirmation,
      confirmationResults: extractedData.confirmationResults as ParsedPDFData['confirmationResults'],
    }

    return (
      <div className="space-y-8">
        <FieldGroupHeader title="Extract Data" description="Review the extracted data" />
        <ParsedDataDisplayField data={parsedData} showRawText />
      </div>
    )
  },
})
```

#### 3.3 MatchCollection Step
**File**: `steps/MatchCollection.tsx`
**Pattern**: Convert VerifyTestFieldGroup to withForm() step

**Key changes**:
- Replace `withFieldGroup` with `withForm`
- Use `getLabScreenFormOpts('matchCollection')`
- Access form values via `form.store` instead of `group.form.store`
- Set field values via `form.setFieldValue` instead of `group.setFieldValue`
- Filter for 'collected' status tests
- Use field name `matchCollection.*` instead of `verifyTest.*`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Check, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { fetchPendingTests } from '@/views/PDFUploadWizard/actions'
import { useExtractPdfQuery } from '@/views/PDFUploadWizard/queries'
import { getRankedTestMatches, type DrugTest } from '@/views/PDFUploadWizard/utils/testMatching'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { wizardContainerStyles } from '@/views/PDFUploadWizard/styles'
import { cn } from '@/utilities/cn'
import { getLabScreenFormOpts } from '../shared-form'

export const MatchCollectionStep = withForm({
  ...getLabScreenFormOpts('matchCollection'),

  render: function Render({ form }) {
    const [isLoading, setIsLoading] = useState(true)
    const [pendingTests, setPendingTests] = useState<DrugTest[]>([])
    const [matchedTest, setMatchedTest] = useState<DrugTest | null>(null)
    const [showAllTests, setShowAllTests] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Get uploaded file from form to access extracted data
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, '11-panel-lab')

    useEffect(() => {
      async function loadPendingTests() {
        try {
          setIsLoading(true)
          const result = await fetchPendingTests(['collected']) // Only 'collected' tests
          if (!result.success) throw new Error(result.error)

          const tests = result.tests
          setPendingTests(tests)

          // Auto-match if we have extracted data
          if (extractData?.donorName || extractData?.collectionDate) {
            const testsWithScores = getRankedTestMatches(
              tests,
              extractData.donorName ?? null,
              extractData.collectionDate ?? null,
              extractData.testType,
              true, // isScreenWorkflow = true
            )

            if (testsWithScores.length > 0 && testsWithScores[0].score >= 60) {
              const bestMatch = testsWithScores[0]
              setMatchedTest(bestMatch.test)
              form.setFieldValue('matchCollection.testId', bestMatch.test.id)
              form.setFieldValue('matchCollection.clientName', bestMatch.test.clientName)
              form.setFieldValue('matchCollection.testType', bestMatch.test.testType)
              form.setFieldValue('matchCollection.collectionDate', bestMatch.test.collectionDate)
              form.setFieldValue('matchCollection.screeningStatus', bestMatch.test.screeningStatus)
              form.setFieldValue('matchCollection.matchType', bestMatch.score === 100 ? 'exact' : 'fuzzy')
              form.setFieldValue('matchCollection.score', bestMatch.score)
            }
          }

          setIsLoading(false)
        } catch (err) {
          console.error('Failed to load pending tests:', err)
          setError(err instanceof Error ? err.message : 'Failed to load pending tests')
          setIsLoading(false)
        }
      }

      loadPendingTests()
    }, [extractData, form])

    const handleTestSelect = (test: DrugTest) => {
      setMatchedTest(test)
      form.setFieldValue('matchCollection.testId', test.id)
      form.setFieldValue('matchCollection.clientName', test.clientName)
      form.setFieldValue('matchCollection.testType', test.testType)
      form.setFieldValue('matchCollection.collectionDate', test.collectionDate)
      form.setFieldValue('matchCollection.screeningStatus', test.screeningStatus)
      form.setFieldValue('matchCollection.matchType', 'manual')
      form.setFieldValue('matchCollection.score', 100)
    }

    // Loading state
    if (isLoading) {
      return (
        <div className={wizardContainerStyles.content}>
          <FieldGroupHeader title="Match Pending Test" description="Finding tests that match this screening" />
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">Loading pending tests...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    // Error state
    if (error) {
      return (
        <div className={wizardContainerStyles.content}>
          <FieldGroupHeader title="Match Pending Test" description="" />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )
    }

    // No tests found
    if (pendingTests.length === 0) {
      return (
        <div className={wizardContainerStyles.content}>
          <FieldGroupHeader title="Match Pending Test" description="" />
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No pending tests found with status: collected</AlertDescription>
          </Alert>
        </div>
      )
    }

    // Calculate scores for all tests
    const testsWithScores = getRankedTestMatches(
      pendingTests,
      extractData?.donorName ?? null,
      extractData?.collectionDate ?? null,
      extractData?.testType,
      true, // isScreenWorkflow
    )

    // Show top 3 or all if requested
    const displayedTests = showAllTests ? testsWithScores : testsWithScores.slice(0, 3)

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader
          title="Match Pending Test"
          description="Select the test that this screening result belongs to"
        />
        <div className={cn(wizardContainerStyles.fields, 'text-base md:text-lg')}>
          {extractData?.donorName && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Extracted from PDF:</strong> {extractData.donorName}
                {extractData.collectionDate && <span> • {format(new Date(extractData.collectionDate), 'PPp')}</span>}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {displayedTests.map(({ test, score }) => {
              const isSelected = matchedTest?.id === test.id
              const isHighConfidence = score >= 80
              const isMediumConfidence = score >= 60 && score < 80

              return (
                <Card
                  key={test.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary ring-primary ring-2' : ''
                  }`}
                  onClick={() => handleTestSelect(test)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-start gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={test.clientHeadshot ?? undefined} alt={test.clientName} />
                          <AvatarFallback className="text-sm">
                            {test.clientName
                              .split(' ')
                              .map((n) => n.charAt(0))
                              .join('')
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            {test.clientName}
                            {isSelected && <Check className="text-primary h-5 w-5" />}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {format(new Date(test.collectionDate), 'PPp')} • {test.testType}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isHighConfidence && <Badge variant="default">High Match ({score}%)</Badge>}
                        {isMediumConfidence && <Badge variant="secondary">Medium Match ({score}%)</Badge>}
                        {!isHighConfidence && !isMediumConfidence && score > 0 && (
                          <Badge variant="outline">Low Match ({score}%)</Badge>
                        )}
                        <Badge variant="outline">{test.screeningStatus}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </div>

          {!showAllTests && testsWithScores.length > 3 && (
            <Button type="button" variant="outline" className="w-full" onClick={() => setShowAllTests(true)}>
              <ChevronDown className="mr-2 h-4 w-4" />
              Show {testsWithScores.length - 3} more pending tests
            </Button>
          )}

          {!matchedTest && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please select a pending test to continue</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    )
  },
})
```

#### 3.4 LabScreenData Step
**File**: `steps/LabScreenData.tsx`
**Pattern**: Similar to instant-test VerifyDataStep, but adapted for lab screening

**Key differences**:
- Uses `labScreenData` field name instead of `verifyData`
- No medications display (comes from matched test's client, can show if needed)
- May display confirmation results from lab PDF
- Shows matched client info from matchCollection step

```typescript
'use client'

import { useEffect } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import InputDateTimePicker from '@/components/input-datetime-picker'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { getLabScreenFormOpts } from '../shared-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldError, FieldLegend } from '@/components/ui/field'
import { useExtractPdfQuery } from '../../../queries'
import { formatSubstance } from '@/lib/substances'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { cn } from '@/utilities/cn'
import { AlertTriangle } from 'lucide-react'

export const LabScreenDataStep = withForm({
  ...getLabScreenFormOpts('labScreenData'),

  render: function Render({ form }) {
    const formValues = useStore(form.store, (state) => state.values)
    const matchCollection = formValues.matchCollection
    const labScreenData = formValues.labScreenData
    const uploadedFile = formValues.upload.file

    // Get extracted data from query
    const { data: extractData } = useExtractPdfQuery(uploadedFile, '11-panel-lab')

    // Initialize form with extracted data
    useEffect(() => {
      if (extractData) {
        if (extractData.collectionDate) {
          form.setFieldValue('labScreenData.collectionDate', extractData.collectionDate)
        }
        if (extractData.detectedSubstances) {
          form.setFieldValue('labScreenData.detectedSubstances', extractData.detectedSubstances)
        }
        if (extractData.isDilute !== undefined) {
          form.setFieldValue('labScreenData.isDilute', extractData.isDilute)
        }
        if (extractData.testType) {
          form.setFieldValue('labScreenData.testType', extractData.testType)
        }
      }
    }, [extractData, form])

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Verify Lab Screening Data"
          description="Review and adjust the extracted lab results before updating the test record"
        />

        {/* Matched Test Info */}
        {matchCollection && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Matched Test</p>
                <p className="font-medium">{matchCollection.clientName}</p>
                <p className="text-sm">{matchCollection.testType}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Data Form */}
        <Card className="@container shadow-md">
          <CardContent className="grid gap-6 pt-6">
            {/* Test Type */}
            <FieldGroup className="grid @lg:grid-cols-2">
              <form.Field name="labScreenData.testType">
                {(field) => (
                  <Field className="@lg:col-span-1">
                    <FieldLabel>Test Type</FieldLabel>
                    <Input value={field.state.value} disabled readOnly />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>

            {/* Collection Date/Time */}
            <FieldGroup className="grid @lg:grid-cols-2">
              <form.Field name="labScreenData.collectionDate">
                {(field) => (
                  <Field className="@lg:col-span-1">
                    <FieldLabel htmlFor="collectionDate">Collection Date &amp; Time</FieldLabel>
                    <InputDateTimePicker
                      id="collectionDate"
                      value={field.state.value ? new Date(field.state.value) : undefined}
                      onChange={(value) => field.handleChange(value?.toISOString() ?? '')}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>

            {/* Detected Substances */}
            <form.AppField name="labScreenData.detectedSubstances">
              {(field) => <field.SubstanceChecklistField />}
            </form.AppField>

            {/* Dilute Sample */}
            <Field orientation="horizontal">
              <form.Field name="labScreenData.isDilute">
                {(field) => (
                  <Checkbox
                    id="isDilute"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                  />
                )}
              </form.Field>
              <FieldLabel htmlFor="isDilute" className="cursor-pointer font-normal">
                Sample is Dilute
              </FieldLabel>
            </Field>

            {/* Breathalyzer Section */}
            <div className="bg-muted/50 border-border space-y-4 rounded-lg border p-4">
              <FieldLegend>Breathalyzer Test (Optional)</FieldLegend>
              <Field orientation="horizontal">
                <form.Field name="labScreenData.breathalyzerTaken">
                  {(field) => (
                    <Checkbox
                      id="breathalyzerTaken"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                    />
                  )}
                </form.Field>
                <FieldLabel htmlFor="breathalyzerTaken" className="cursor-pointer font-normal">
                  Breathalyzer test was administered
                </FieldLabel>
              </Field>

              {labScreenData?.breathalyzerTaken && (
                <form.Field name="labScreenData.breathalyzerResult">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="breathalyzerResult">
                        BAC Result <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="breathalyzerResult"
                        type="number"
                        step="0.001"
                        min="0"
                        max="1"
                        value={field.state.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value)
                          field.handleChange(value)
                        }}
                        placeholder="0.000"
                      />
                      <p className="text-muted-foreground text-xs">
                        Enter result with 3 decimal places. Threshold: 0.000 (any detectable alcohol = positive)
                      </p>
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
})
```

#### 3.5 Confirm Step
**File**: `steps/confirm/Step.tsx`
**Pattern**: Summary display before submission

```typescript
'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, User, FileText } from 'lucide-react'
import { getLabScreenFormOpts } from '../../shared-form'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { useStore } from '@tanstack/react-form'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utilities/cn'

export const ConfirmStep = withForm({
  ...getLabScreenFormOpts('confirm'),

  render: function Render({ form }) {
    const formValues = useStore(form.store, (state) => state.values)
    const { matchCollection, labScreenData } = formValues

    return (
      <div>
        <FieldGroupHeader
          title="Confirm Lab Screening"
          description="Review the final data before updating the test record"
        />

        <Card>
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-primary h-5 w-5" /> Screening Summary
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Matched Test */}
            <SummarySection icon={User} title="Matched Test">
              <p className="font-medium">{matchCollection?.clientName}</p>
              <p className="text-sm text-muted-foreground">{matchCollection?.testType}</p>
            </SummarySection>

            {/* Test Details */}
            <SummarySection icon={FileText} title="Screening Results">
              <p className="text-sm">
                <span className="font-medium">Test Type:</span> {labScreenData?.testType}
              </p>
              <p className="text-sm">
                <span className="font-medium">Collection Date:</span>{' '}
                {labScreenData?.collectionDate ? new Date(labScreenData.collectionDate).toLocaleString() : 'Not set'}
              </p>
              {labScreenData?.isDilute && <Badge variant="outline">Dilute Sample</Badge>}
            </SummarySection>

            {/* Detected Substances */}
            {labScreenData?.detectedSubstances && labScreenData.detectedSubstances.length > 0 && (
              <SummarySection icon={FileText} title="Detected Substances">
                <div className="flex flex-wrap gap-2">
                  {labScreenData.detectedSubstances.map((substance) => (
                    <Badge key={substance} variant="destructive">
                      {substance}
                    </Badge>
                  ))}
                </div>
              </SummarySection>
            )}

            {/* Breathalyzer */}
            {labScreenData?.breathalyzerTaken && (
              <SummarySection icon={FileText} title="Breathalyzer">
                <p className="text-sm">BAC: {labScreenData.breathalyzerResult ?? 'N/A'}</p>
              </SummarySection>
            )}
          </CardContent>
        </Card>
      </div>
    )
  },
})

function SummarySection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: any
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1 border-t pt-2', className)}>
      <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="pl-6">{children}</div>
    </div>
  )
}
```

#### 3.6 Emails Step
**File**: `steps/Emails.tsx`
**Pattern**: Reuse EmailsFieldGroup component

```typescript
'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getLabScreenFormOpts } from '../shared-form'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'

export const EmailsStep = withForm({
  ...getLabScreenFormOpts('emails'),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Review Email Notifications"
          description="Configure email recipients for screening results (optional)"
        />
        <EmailsFieldGroup form={form} />
      </div>
    )
  },
})
```

### Phase 4: Create Navigation Component

**File**: `components/Navigation.tsx`
**Pattern**: Copy from instant-test, adjust for lab screen

```typescript
'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Button } from '@/components/ui/button'
import { labScreenFormOpts, steps } from '../shared-form'

export const LabScreenNavigation = withForm({
  ...labScreenFormOpts,
  props: { onBack: (): void => {} },

  render: function Render({ form, onBack }) {
    const [currentStep, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps as readonly string[]).withDefault('upload'),
    )

    const [isSubmitting, errors] = useStore(form.store, (state) => [
      state.isSubmitting,
      state.errors,
    ])

    const currentStepIndex = steps.indexOf(currentStep as any)
    const isFirstStep = currentStepIndex === 0
    const isLastStep = currentStepIndex === steps.length - 1

    // Determine if current step has errors
    const fieldNames = Object.keys(errors)
    const currentStepHasErrors = fieldNames.some((fieldName) =>
      fieldName.startsWith(`${currentStep}.`)
    )

    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        setCurrentStep(steps[currentStepIndex - 1], { history: 'push' })
      }
    }

    return (
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>
        <Button type="submit" disabled={currentStepHasErrors || isSubmitting}>
          {isLastStep ? 'Update Test Record' : 'Next'}
        </Button>
      </div>
    )
  },
})
```

### Phase 5: Create Actions

**File**: `actions/updateLabScreen.ts`
**Pattern**: Server action wrapper around existing `updateTestWithScreening`

```typescript
'use server'

import { updateTestWithScreening } from '@/views/PDFUploadWizard/actions'
import { generateTestFilename } from '@/views/PDFUploadWizard/utils/generateFilename'
import type { FormValues } from '../validators'
import type { ExtractedPdfData } from '@/views/PDFUploadWizard/queries'

export async function updateLabScreenAction(
  formValues: FormValues,
  extractedData: ExtractedPdfData | undefined,
) {
  try {
    // Build test data from form values
    const testData = {
      testId: formValues.matchCollection.testId,
      testType: formValues.labScreenData.testType,
      collectionDate: formValues.labScreenData.collectionDate,
      detectedSubstances: formValues.labScreenData.detectedSubstances,
      isDilute: formValues.labScreenData.isDilute,
      breathalyzerTaken: formValues.labScreenData.breathalyzerTaken,
      breathalyzerResult: formValues.labScreenData.breathalyzerResult,
    }

    // Build confirmation results from extracted data (if available)
    const confirmationResults = extractedData?.confirmationResults ?? null

    // Generate filename
    const filename = generateTestFilename(
      formValues.matchCollection.clientName,
      formValues.labScreenData.testType,
      formValues.labScreenData.collectionDate,
    )

    // Call existing action
    const result = await updateTestWithScreening(
      testData,
      confirmationResults,
      formValues.upload.file,
      filename,
    )

    return result
  } catch (error) {
    console.error('Error updating lab screen:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update test record',
    }
  }
}
```

## Testing & Validation

### Manual Testing Checklist
1. ✅ Upload a lab PDF and verify extraction
2. ✅ Verify auto-matching works with high confidence tests
3. ✅ Manually select a test from the list
4. ✅ Edit lab screening data fields
5. ✅ Verify breathalyzer validation (required if taken)
6. ✅ Review confirmation summary
7. ✅ Configure emails (default: client disabled, referral enabled)
8. ✅ Submit and verify test record updated to 'screened' status
9. ✅ Verify PDF uploaded to private-media collection
10. ✅ Test navigation: back button, URL navigation, validation guards

### Build Validation
- Run `pnpm build` to ensure no TypeScript errors
- Verify no import errors
- Check that all step components render without errors

## Migration Path

1. **Fix existing files** (validators, shared-form, Workflow)
2. **Create directory structure** (folders)
3. **Create step components** (one at a time, test each)
4. **Create navigation** (reuses form instance)
5. **Create actions** (wrapper around existing logic)
6. **Test end-to-end** (full workflow)
7. **Delete old workflow** (EnterLabScreenWorkflow.tsx once new version works)

## Success Criteria
- ✅ All 6 steps work correctly
- ✅ URL navigation maintains form state
- ✅ Validation works at each step
- ✅ Auto-matching selects correct pending test
- ✅ Test record updates successfully
- ✅ No TypeScript errors
- ✅ Follows same pattern as instant-test workflow
- ✅ Old workflow can be safely deleted
