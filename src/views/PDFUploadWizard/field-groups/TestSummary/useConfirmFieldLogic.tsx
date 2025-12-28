import { useStore } from '@tanstack/react-form'
import {
  useComputeTestResultPreviewQuery,
  useExtractPdfQuery,
  useGetClientFromTestQuery,
} from '../../queries'
import { generateTestFilename } from '../../utils/generateFilename'
import { PdfUploadFormType } from '../../schemas/pdfUploadSchemas'
import { SubstanceValue } from '@/fields/substanceOptions'

export function useConfirmFieldLogic(group: any) {
  const formValues = useStore(group.form.store, (state: any) => state.values)
  const verifyData = formValues?.verifyData as PdfUploadFormType['verifyData']
  const verifyTest = formValues?.verifyTest
  const uploadData = formValues?.uploadData as PdfUploadFormType['uploadData']
  const chosenClient = formValues?.clientData as PdfUploadFormType['clientData']

  const { data: extractData } = useExtractPdfQuery(uploadData?.file, uploadData?.wizardType)

  // For lab workflows, fetch client data from the matched test
  const { data: clientFromChosenTest } = useGetClientFromTestQuery(verifyTest?.testId)

  const client = chosenClient || clientFromChosenTest

  const previewQuery = useComputeTestResultPreviewQuery(
    chosenClient?.id,
    (verifyData?.detectedSubstances as SubstanceValue[]) ?? [],
    verifyData?.testType,
    verifyData?.breathalyzerTaken ?? false,
    verifyData?.breathalyzerResult ?? null,
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
    preview: previewQuery.data,
    isLoading: previewQuery.isLoading,
    filenames: {
      original: uploadData?.file?.name || 'No file',
      new: newFilename,
      size: uploadData?.file ? `${(uploadData.file.size / 1024).toFixed(2)} KB` : '0 KB',
    },
  }
}
