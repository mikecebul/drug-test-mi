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
import { getInstantTestFormOpts } from '../shared-form'

export const ExtractStep = withForm({
  ...getInstantTestFormOpts('extract'),

  render: function Render({ form }) {
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)
    const { data: extractedData, isLoading, error } = useExtractPdfQuery(uploadedFile, '15-panel-instant')

    // Auto-sync extracted data to form when available
    useEffect(() => {
      if (extractedData) {
        form.setFieldValue('extract.extracted', true)
        // Pre-populate verifyData with extracted values
        if (extractedData.collectionDate) {
          form.setFieldValue('verifyData.collectionDate', extractedData.collectionDate)
        }
        if (extractedData.detectedSubstances) {
          form.setFieldValue('verifyData.detectedSubstances', extractedData.detectedSubstances)
        }
        if (extractedData.isDilute !== undefined) {
          form.setFieldValue('verifyData.isDilute', extractedData.isDilute)
        }
      }
    }, [extractedData, form])

    // Loading state
    if (isLoading) {
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Extracting Data..." description="Processing your PDF file" />
          <Card>
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

    // Error state
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
                The PDF format may not be supported, or the file may be damaged. Please try a different file or contact
                support if this issue persists.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    // No data yet
    if (!extractedData) {
      return (
          <FieldGroupHeader title="No Data" description="No file uploaded. Please go back." />
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
