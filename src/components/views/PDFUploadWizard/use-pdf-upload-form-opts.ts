'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import type { PdfUploadFormType } from './schemas/pdfUploadSchemas'
import { createDrugTestWithEmailReview } from './actions'
import type { SubstanceValue } from '@/fields/substanceOptions'

const defaultValues: PdfUploadFormType = {
  uploadData: {
    testType: '15-panel-instant' as const,
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
    testType: undefined,
    hasConfirmation: undefined,
    confirmationResults: undefined,
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
    clientData: null,
  },
  confirmData: {
    previewComputed: false,
  },
  reviewEmailsData: {
    clientEmailEnabled: false,
    clientRecipients: [],
    referralEmailEnabled: true,
    referralRecipients: [],
    previewsLoaded: false,
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

        // Validate email configuration
        if (!value.reviewEmailsData.clientEmailEnabled && !value.reviewEmailsData.referralEmailEnabled) {
          toast.error('At least one email type must be enabled')
          throw new Error('At least one email type must be enabled')
        }

        // Convert File to buffer array for server action
        const arrayBuffer = await value.uploadData.file.arrayBuffer()

        const result = await createDrugTestWithEmailReview(
          {
            clientId: value.clientData.id,
            testType: value.verifyData.testType,
            collectionDate: new Date(value.verifyData.collectionDate).toISOString(),
            detectedSubstances: value.verifyData.detectedSubstances as SubstanceValue[],
            isDilute: value.verifyData.isDilute,
            pdfBuffer: Array.from(new Uint8Array(arrayBuffer)),
            pdfFilename: value.uploadData.file.name,
            hasConfirmation: value.extractData.hasConfirmation,
            confirmationResults: value.extractData.confirmationResults as any,
          },
          {
            clientEmailEnabled: value.reviewEmailsData.clientEmailEnabled,
            clientRecipients: value.reviewEmailsData.clientRecipients,
            referralEmailEnabled: value.reviewEmailsData.referralEmailEnabled,
            referralRecipients: value.reviewEmailsData.referralRecipients,
          }
        )

        if (result.success && result.testId) {
          toast.success('Drug test created and emails sent successfully!')
          onComplete(result.testId)
        } else {
          toast.error('Failed to create drug test')
          throw new Error(result.error || 'Failed to create drug test')
        }
      } catch (error) {
        console.error('PDF Upload wizard error:', error)

        if (error instanceof Error && !error.message.includes('uploaded') &&
            !error.message.includes('selected') && !error.message.includes('required') &&
            !error.message.includes('enabled')) {
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
