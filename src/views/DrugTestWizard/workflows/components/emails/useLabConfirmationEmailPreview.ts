import type { SubstanceValue } from '@/fields/substanceOptions'
import { useGetClientFromTestQuery, useGetConfirmationEmailPreviewQuery } from '../../../queries'
import type { EmailPreviewData } from './useLabScreenEmailPreview'
import { useMemo } from 'react'

interface UseLabConfirmationEmailPreviewParams {
  testId?: string
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
  originalDetectedSubstances?: SubstanceValue[]
}

export function useLabConfirmationEmailPreview(params: UseLabConfirmationEmailPreviewParams) {
  // First get the client from the test ID
  const { data: client } = useGetClientFromTestQuery(params.testId)

  // Compute adjusted substances (substances with confirmed negatives removed)
  const adjustedSubstances = useMemo(() => {
    const originalSubstances = params.originalDetectedSubstances || []
    const confirmationResults = params.confirmationResults || []

    return originalSubstances.filter((substance: SubstanceValue) => {
      const confirmationResult = confirmationResults.find(
        (r) => r.substance.toLowerCase() === substance.toLowerCase(),
      )
      return !(confirmationResult && confirmationResult.result === 'confirmed-negative')
    })
  }, [params.originalDetectedSubstances, params.confirmationResults])

  // Then fetch email preview using confirmation results
  const queryResult = useGetConfirmationEmailPreviewQuery({
    clientId: client?.id,
    testId: params.testId,
    confirmationResults: params.confirmationResults || [],
    adjustedSubstances,
  })

  // Transform the result to match EmailPreviewData interface
  return {
    data: queryResult.data?.success && queryResult.data?.data
      ? ({
          clientEmail: queryResult.data.data.clientEmail,
          clientTitle: 'Final Confirmation Results',
          clientHtml: queryResult.data.data.clientHtml,
          clientSubject: queryResult.data.data.clientSubject,
          referralType: queryResult.data.data.referralType,
          referralEmails: queryResult.data.data.referralEmails,
          referralTitle: queryResult.data.data.referralTitle,
          referralPresetId: queryResult.data.data.referralPresetId,
          hasExplicitReferralRecipients: queryResult.data.data.hasExplicitReferralRecipients,
          referralRecipientsDetailed: queryResult.data.data.referralRecipientsDetailed,
          clientAdditionalRecipientsDetailed: queryResult.data.data.clientAdditionalRecipientsDetailed,
          referralHtml: queryResult.data.data.referralHtml,
          referralSubject: queryResult.data.data.referralSubject,
        } as EmailPreviewData)
      : undefined,
    isLoading: queryResult.isLoading,
    error: queryResult.error || (queryResult.data?.success === false ? new Error(queryResult.data.error) : undefined),
  }
}
