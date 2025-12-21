'use client'

import React from 'react'
import { useStore } from '@tanstack/react-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileX2 } from 'lucide-react'
import ParsedDataDisplayField from '@/blocks/Form/field-components/parsed-data-display-field'
import type { ParsedPDFData, WorkflowType } from '../types'
import { z } from 'zod'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { useExtractPdfQuery } from '../queries'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { WizardSection } from '../components/WizardSection'
import { LoadingCard } from '../components/LoadingCard'

// Minimal schema - extraction data lives in TanStack Query cache
// This just validates that the step can proceed
export const extractFieldSchema = z.object({
  extracted: z.boolean(),
})

interface BaseExtractFieldGroupProps {
  form: any
  fields: string
  title?: string
  description?: string
  workflowType: WorkflowType
}

/**
 * BaseExtractFieldGroup - Displays extracted PDF data
 *
 * Uses TanStack Query for extraction with caching and loading states.
 * Data is synced to form fields in VerifyDataFieldGroup for user editing.
 * On form submission, email-building fields come from query cache.
 */
export function BaseExtractFieldGroup({
  form,
  title = 'Extract Data',
  description = 'Review the extracted data',
  workflowType,
}: BaseExtractFieldGroupProps) {
  // Get the file from the uploadData field group
  const formValues = useStore(form.store, (state: any) => state.values)
  const uploadedFile = formValues?.uploadData?.file as File | null

  // TanStack Query handles extraction with caching and loading states
  // Extractor auto-detects specific testType (e.g., '11-panel-lab', '17-panel-sos-lab', 'etg-lab', '15-panel-instant')
  const { data: extractedData, isLoading, error } = useExtractPdfQuery(uploadedFile, workflowType)

  // Show loading state while extracting
  if (isLoading) {
    return (
      <WizardSection>
        <FieldGroupHeader title="Extracting Data..." description="Processing your PDF file" />
        <LoadingCard message="Please wait while we extract the test data" />
      </WizardSection>
    )
  }

  // Show error state if extraction failed
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return (
      <WizardSection>
        <FieldGroupHeader title="Extraction Failed" description="Unable to process the PDF file" />
        <Alert variant="destructive">
          <FileX2 className="h-4 w-4" />
          <AlertDescription>
            <p className="mb-1 text-base font-medium">{errorMessage}</p>
            <p className="text-sm">
              The PDF format may not be supported, or the file may be damaged. Please try a
              different file or contact support if this issue persists.
            </p>
          </AlertDescription>
        </Alert>
      </WizardSection>
    )
  }

  // No data yet (shouldn't happen if file validation passed)
  if (!extractedData) {
    return (
      <WizardSection>
        <FieldGroupHeader title="No Data" description="No file uploaded" />
      </WizardSection>
    )
  }

  // Build ParsedPDFData object for display from query data
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
    <WizardSection>
      <FieldGroupHeader title={title} description={description} />

      {/* Display extracted data directly from query */}
      <ParsedDataDisplayField data={parsedData} showRawText />
    </WizardSection>
  )
}
