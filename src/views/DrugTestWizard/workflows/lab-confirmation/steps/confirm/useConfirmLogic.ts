import { useMemo } from 'react'
import {
  useGetClientFromTestQuery,
  useGetDrugTestQuery,
  useComputeTestResultPreviewQuery,
} from '@/views/DrugTestWizard/queries'
import { generateTestFilename } from '@/views/DrugTestWizard/utils/generateFilename'
import { computeFinalStatus } from '@/collections/DrugTests/services/testResults'
import type { FormValues } from '../../validators'
import type { SubstanceValue } from '@/fields/substanceOptions'

export function useConfirmLogic(formValues: FormValues) {
  const { matchCollection, labConfirmationData, upload } = formValues
  const uploadedFile = upload.file

  // Fetch client from matched test
  const { data: client } = useGetClientFromTestQuery(matchCollection?.testId)

  // Fetch the matched drug test
  const { data: matchedTest } = useGetDrugTestQuery(matchCollection?.testId)

  // Get medications snapshot
  const medications = matchedTest?.medicationsArrayAtTestTime || []

  // Compute adjusted substances (remove confirmed-negatives)
  const adjustedSubstances = useMemo(() => {
    const originalSubstances = labConfirmationData?.originalDetectedSubstances || []
    const confirmationResults = labConfirmationData?.confirmationResults || []

    return originalSubstances.filter((substance: string) => {
      const confirmationResult = confirmationResults.find(
        (r: any) => r.substance.toLowerCase() === substance.toLowerCase(),
      )
      // Exclude if confirmed-negative
      return !(confirmationResult && confirmationResult.result === 'confirmed-negative')
    })
  }, [labConfirmationData])

  // Compute test result preview with adjusted substances
  const previewQuery = useComputeTestResultPreviewQuery(
    client?.id,
    adjustedSubstances as SubstanceValue[],
    matchCollection?.testType as '11-panel-lab' | '15-panel-instant' | '17-panel-sos-lab' | 'etg-lab',
    matchedTest?.breathalyzerTaken ?? false,
    matchedTest?.breathalyzerResult ?? null,
    medications,
  )

  // Compute final status using service layer
  const finalStatus = useMemo(() => {
    if (!previewQuery.data || !labConfirmationData?.confirmationResults) return null

    return computeFinalStatus({
      initialScreenResult: previewQuery.data.initialScreenResult,
      expectedPositives: previewQuery.data.expectedPositives,
      unexpectedPositives: previewQuery.data.unexpectedPositives,
      confirmationResults: labConfirmationData.confirmationResults.map((r: any) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes,
      })),
      breathalyzerTaken: matchedTest?.breathalyzerTaken ?? false,
      breathalyzerResult: matchedTest?.breathalyzerResult ?? null,
    })
  }, [previewQuery.data, labConfirmationData, matchedTest])

  const newFilename = generateTestFilename({
    client: client || null,
    collectionDate: matchCollection?.collectionDate,
    testType: matchCollection?.testType,
    isConfirmation: true,
  })

  return {
    client,
    matchedTest,
    labConfirmationData,
    medications,
    adjustedSubstances,
    preview: previewQuery.data,
    finalStatus,
    isLoading: previewQuery.isLoading,
    filenames: {
      original: uploadedFile?.name || 'No file',
      new: newFilename,
      size: uploadedFile ? `${(uploadedFile.size / 1024).toFixed(2)} KB` : '0 KB',
    },
  }
}
