import {
  useComputeTestResultPreviewQuery,
  useExtractPdfQuery,
} from '@/views/PDFUploadWizard/queries'
import { generateTestFilename } from '@/views/PDFUploadWizard/utils/generateFilename'
import type { SubstanceValue } from '@/fields/substanceOptions'
import type { FormValues } from '../../../validators'

export function useConfirmLogic(formValues: FormValues) {
  const client = formValues.client
  const verifyData = formValues.verifyData
  const uploadedFile = formValues.upload.file
  // Get medications from form state (added during the workflow)
  const medications = formValues.medications ?? []

  // Get extracted data from query cache (cached from Extract step)
  const { data: extractData } = useExtractPdfQuery(uploadedFile, '15-panel-instant')

  // Map medications to the format expected by the query
  const medicationsForQuery = medications.map((med) => ({
    medicationName: med.medicationName,
    detectedAs: (med.detectedAs || []) as string[],
    requireConfirmation: med.requireConfirmation ?? undefined,
    status: med.status,
  }))

  // Compute test result preview with medications from form state
  const previewQuery = useComputeTestResultPreviewQuery(
    client?.id,
    (verifyData?.detectedSubstances as SubstanceValue[]) ?? [],
    verifyData?.testType,
    verifyData?.breathalyzerTaken ?? false,
    verifyData?.breathalyzerResult ?? null,
    medicationsForQuery, // Pass medications from wizard form state
  )

  const newFilename = generateTestFilename({
    client: client || { firstName: 'Unknown', lastName: 'Unknown' },
    collectionDate: verifyData?.collectionDate,
    testType: verifyData?.testType,
    isConfirmation: false,
  })

  return {
    client,
    verifyData,
    extractData,
    medications,
    preview: previewQuery.data,
    isLoading: previewQuery.isLoading,
    filenames: {
      original: uploadedFile?.name || 'No file',
      new: newFilename,
      size: uploadedFile ? `${(uploadedFile.size / 1024).toFixed(2)} KB` : '0 KB',
    },
  }
}
