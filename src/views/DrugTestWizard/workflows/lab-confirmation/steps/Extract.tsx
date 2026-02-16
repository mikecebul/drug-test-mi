'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileX2 } from 'lucide-react'
import ParsedDataDisplayField from '@/blocks/Form/field-components/parsed-data-display-field'
import { useExtractPdfQuery } from '@/views/DrugTestWizard/queries'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { getLabConfirmationFormOpts } from '../shared-form'

export const ExtractStep = withForm({
  ...getLabConfirmationFormOpts('extract'),

  render: function Render({ form }) {
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)
    const { data: extractedData, isLoading, error } = useExtractPdfQuery(uploadedFile, 'enter-lab-confirmation')

    // Auto-sync extracted data to form when available
    useEffect(() => {
      if (extractedData) {
        form.setFieldValue('extract.extracted', true)
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
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="text-primary h-12 w-12 animate-spin" />
                  <p className="text-muted-foreground text-lg">Extracting confirmation data from PDF...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    // Error state
    if (error) {
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Extraction Error" description="" />
          <Alert variant="destructive">
            <FileX2 className="h-4 w-4" />
            <AlertDescription>{error instanceof Error ? error.message : 'Failed to extract data from PDF'}</AlertDescription>
          </Alert>
        </div>
      )
    }

    // Success state
    return (
      <div className="space-y-8">
        <FieldGroupHeader
          title="Confirmation Data Extracted"
          description="Review the extracted confirmation results"
        />

        {extractedData && <ParsedDataDisplayField data={extractedData} />}
      </div>
    )
  },
})
