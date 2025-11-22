'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import type { PdfUploadFormType } from './schemas/pdfUploadSchemas'
import { createDrugTest } from './actions'

const defaultValues: PdfUploadFormType = {
  uploadData: {
    file: null as any, // File object will be set by user
  },
  extractData: {
    donorName: null,
    collectionDate: null,
    detectedSubstances: [],
    isDilute: false,
    rawText: '',
    confidence: 'low',
    extractedFields: [],
  },
  clientData: {
    id: '',
    firstName: '',
    lastName: '',
    middleInitial: null,
    email: '',
    dob: null,
    matchType: 'fuzzy',
    score: 0,
  },
  verifyData: {
    testType: '15-panel-instant',
    collectionDate: '',
    detectedSubstances: [],
    isDilute: false,
  },
  confirmData: {
    previewComputed: false,
  },
}

export const usePdfUploadFormOpts = ({
  onComplete,
}: {
  onComplete: (testId: string) => void
}) => {
  return formOptions({
    defaultValues: defaultValues,
    onSubmit: async ({ value }: { value: PdfUploadFormType }) => {
      try {
        // Validate required data
        if (!value.uploadData.file) {
          toast.error('No file uploaded')
          throw new Error('No file uploaded')
        }

        if (!value.clientData.id) {
          toast.error('No client selected')
          throw new Error('No client selected')
        }

        if (!value.verifyData.collectionDate) {
          toast.error('Collection date is required')
          throw new Error('Collection date is required')
        }

        // Convert File to buffer array for server action
        const arrayBuffer = await value.uploadData.file.arrayBuffer()

        const result = await createDrugTest({
          clientId: value.clientData.id,
          testType: value.verifyData.testType,
          collectionDate: new Date(value.verifyData.collectionDate).toISOString(),
          detectedSubstances: value.verifyData.detectedSubstances,
          isDilute: value.verifyData.isDilute,
          pdfBuffer: Array.from(new Uint8Array(arrayBuffer)),
          pdfFilename: value.uploadData.file.name,
        })

        if (result.success && result.testId) {
          toast.success('Drug test created successfully!')
          onComplete(result.testId)
        } else {
          toast.error('Failed to create drug test')
          throw new Error(result.error || 'Failed to create drug test')
        }
      } catch (error) {
        console.error('PDF Upload wizard error:', error)

        if (error instanceof Error && !error.message.includes('uploaded') &&
            !error.message.includes('selected') && !error.message.includes('required')) {
          toast.error(
            error instanceof Error ? error.message : 'Failed to create drug test. Please try again.',
          )
        }
        throw error
      }
    },
  })
}

export { defaultValues }
