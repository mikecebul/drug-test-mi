'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileX2 } from 'lucide-react'
import { extractPdfData } from '../actions'
import ParsedDataDisplayField from '@/blocks/Form/field-components/parsed-data-display-field'
import type { ParsedPDFData } from '../types'
import type { SubstanceValue } from '@/fields/substanceOptions'

const defaultValues = {
  donorName: null as string | null,
  collectionDate: null as Date | null,
  detectedSubstances: [] as SubstanceValue[],
  isDilute: false,
  rawText: '',
  confidence: 'low' as 'high' | 'medium' | 'low',
  extractedFields: [] as string[],
}

export const ExtractFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Extract Data',
  },

  render: function Render({ group, title }) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>('')

    // Get the file from the uploadData field group
    const formValues = useStore(group.form.store, (state) => state.values)
    const uploadedFile = (formValues as any).uploadData?.file as File | null

    useEffect(() => {
      async function parseFile() {
        if (!uploadedFile) {
          setError('No file uploaded')
          setLoading(false)
          return
        }

        setLoading(true)
        setError('')

        const formData = new FormData()
        formData.append('file', uploadedFile)

        const result = await extractPdfData(formData)

        if (result.success && result.data) {
          // Update form fields with extracted data
          group.setFieldValue('donorName', result.data.donorName)
          group.setFieldValue('collectionDate', result.data.collectionDate)
          group.setFieldValue('detectedSubstances', result.data.detectedSubstances)
          group.setFieldValue('isDilute', result.data.isDilute)
          group.setFieldValue('rawText', result.data.rawText)
          group.setFieldValue('confidence', result.data.confidence)
          group.setFieldValue('extractedFields', result.data.extractedFields)
        } else {
          setError(result.error || 'Unknown error occurred')
        }

        setLoading(false)
      }

      parseFile()
    }, [uploadedFile])

    const extractData = useStore(group.store, (state) => state.values)

    if (loading) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">Extracting Data...</h2>
            <p className="text-muted-foreground">Processing your PDF file</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <div className="space-y-4 text-center">
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">
                    Please wait while we extract the test data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    if (error) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">Extraction Failed</h2>
            <p className="text-muted-foreground">Unable to process the PDF file</p>
          </div>
          <Alert variant="destructive">
            <FileX2 className="h-4 w-4" />
            <AlertDescription>
              <p className="mb-1 font-medium">{error}</p>
              <p className="text-sm">
                The PDF format may not be supported, or the file may be damaged. Please try a
                different file or contact support if this issue persists.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    // Build ParsedPDFData object for display
    const parsedData: ParsedPDFData = {
      donorName: extractData.donorName,
      collectionDate: extractData.collectionDate,
      detectedSubstances: extractData.detectedSubstances,
      isDilute: extractData.isDilute,
      rawText: extractData.rawText,
      confidence: extractData.confidence,
      extractedFields: extractData.extractedFields,
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">Review the extracted data</p>
        </div>

        {/* Use the ParsedDataDisplayField to show extracted data */}
        <ParsedDataDisplayField data={parsedData} showRawText />
      </div>
    )
  },
})
