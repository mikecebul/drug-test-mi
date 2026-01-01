import {
  useExtractPdfQuery,
  useGetClientFromTestQuery,
  useGetDrugTestWithMedicationsQuery,
  useComputeTestResultPreviewQuery,
} from '@/views/PDFUploadWizard/queries'
import { generateTestFilename } from '@/views/PDFUploadWizard/utils/generateFilename'
import type { FormValues } from '../../validators'
import type { SubstanceValue } from '@/fields/substanceOptions'

export function useConfirmLogic(formValues: FormValues) {
  const { matchCollection, labScreenData, upload } = formValues
  const uploadedFile = upload.file

  // Get extracted data from query cache (cached from Extract step)
  const { data: extractData } = useExtractPdfQuery(uploadedFile, 'enter-lab-screen')

  // Fetch client data from the matched test
  const { data: client } = useGetClientFromTestQuery(matchCollection?.testId)

  // Fetch the matched drug test with medications
  const { data: matchedTest } = useGetDrugTestWithMedicationsQuery(matchCollection?.testId)

  // Get medications from the matched test (already in correct snapshot format)
  const medications = matchedTest?.medicationsArrayAtTestTime || []

  // Compute test result preview with medications from matched test
  const previewQuery = useComputeTestResultPreviewQuery(
    client?.id,
    (labScreenData?.detectedSubstances as SubstanceValue[]) ?? [],
    labScreenData?.testType,
    matchedTest?.breathalyzerTaken ?? false,
    matchedTest?.breathalyzerResult ?? null,
    medications, // Pass medications directly - they're already MedicationSnapshot[]
  )

  const newFilename = generateTestFilename({
    client: client || null,
    collectionDate: labScreenData?.collectionDate,
    testType: labScreenData?.testType,
    isConfirmation: false,
  })

  return {
    client,
    matchedTest,
    labScreenData,
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
