'use client'

import React from 'react'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileX2 } from 'lucide-react'
import ParsedDataDisplayField from '@/blocks/Form/field-components/parsed-data-display-field'
import type { ParsedPDFData, WizardType } from '../types'
import { z } from 'zod'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { useExtractPdfQuery } from '../queries'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { wizardContainerStyles } from '../styles'

// Minimal schema - extraction data lives in TanStack Query cache
// This just validates that the step can proceed
export const extractFieldSchema = z.object({
  extracted: z.boolean(),
})

interface ExtractFieldGroupProps {
  form: any
  fields: string
  title?: string
}

/**
 * ExtractFieldGroup - Displays extracted PDF data
 *
 * Uses TanStack Query for extraction with caching and loading states.
 * Data is synced to form fields in VerifyDataFieldGroup for user editing.
 * On form submission, email-building fields come from query cache.
 */
export function ExtractFieldGroup({ form, title = 'Extract Data' }: ExtractFieldGroupProps) {
  // Get the file and test type from the uploadData field group
  const formValues = useStore(form.store, (state: any) => state.values)
  const uploadedFile = formValues?.uploadData?.file as File | null
  const wizardType = formValues?.uploadData?.wizardType as WizardType

  // TanStack Query handles extraction with caching and loading states
  const { data: extractedData, isLoading, error } = useExtractPdfQuery(uploadedFile, wizardType)

  // Show loading state while extracting
  if (isLoading) {
    return (
      <div className="space-y-8">
        <FieldGroupHeader title="Extracting Data..." description="Processing your PDF file" />
        <Card className={wizardContainerStyles.card}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="space-y-4 text-center">
                <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
                <p className="text-muted-foreground text-lg">
                  Please wait while we extract the test data
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error state if extraction failed
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return (
      <div className="spaace-y-8">
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
      </div>
    )
  }

  // No data yet (shouldn't happen if file validation passed)
  if (!extractedData) {
    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title="No Data" description="No file uploaded. Please go back." />
      </div>
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
    <div className="space-y-8">
      <FieldGroupHeader title={title} description="Review the extracted data" />

      {/* Display extracted data directly from query */}
      <ParsedDataDisplayField data={parsedData} showRawText />
    </div>
  )
}
