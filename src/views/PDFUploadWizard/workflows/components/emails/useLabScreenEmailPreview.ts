import { useQuery } from '@tanstack/react-query'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { getEmailPreview } from '../../../actions'
import { useGetClientFromTestQuery, useGetDrugTestWithMedicationsQuery } from '../../../queries'

interface UseLabScreenEmailPreviewParams {
  testId?: string
  testType?: string
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  // Note: medications, breathalyzerTaken, and breathalyzerResult are fetched from the matched test
}

export interface EmailPreviewData {
  clientEmail?: string
  clientTitle?: string
  clientHtml?: string
  clientSubject?: string
  referralEmails: string[]
  referralTitle: string
  referralHtml: string
  referralSubject: string
}

export function useLabScreenEmailPreview(params: UseLabScreenEmailPreviewParams) {
  // First get the client from the test ID
  const { data: client } = useGetClientFromTestQuery(params.testId)

  // Fetch the matched drug test with medications using cached query
  const { data: matchedTest } = useGetDrugTestWithMedicationsQuery(params.testId)

  // Then fetch email preview with medications and breathalyzer info from matched test
  return useQuery<EmailPreviewData>({
    queryKey: [
      'lab-screen-email-preview',
      params.testId,
      client?.id,
      params.detectedSubstances,
      params.isDilute,
      matchedTest?.medicationsArrayAtTestTime,
      matchedTest?.breathalyzerTaken,
      matchedTest?.breathalyzerResult,
    ],
    queryFn: async () => {
      if (!client?.id || !params.testType || !matchedTest) {
        return {
          referralEmails: [],
          referralTitle: 'Screening Results',
          referralHtml: '<p>Loading email preview...</p>',
          referralSubject: 'Lab Screening Results',
        }
      }

      // Extract data from matched test
      const collectionDate = matchedTest.collectionDate || new Date().toISOString()
      const medications = matchedTest.medicationsArrayAtTestTime || []
      const breathalyzerTaken = matchedTest.breathalyzerTaken ?? false
      const breathalyzerResult = matchedTest.breathalyzerResult ?? null

      // Call the server action to generate email preview
      const result = await getEmailPreview({
        clientId: client.id,
        detectedSubstances: params.detectedSubstances,
        testType: params.testType as '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab',
        collectionDate,
        isDilute: params.isDilute,
        breathalyzerTaken,
        breathalyzerResult,
        medications, // Pass medications from matched test
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate email preview')
      }

      return {
        clientEmail: result.data.clientEmail,
        clientHtml: result.data.clientHtml,
        clientSubject: result.data.clientSubject,
        referralEmails: result.data.referralEmails,
        referralTitle: result.data.referralTitle,
        referralHtml: result.data.referralHtml,
        referralSubject: result.data.referralSubject,
      }
    },
    enabled: Boolean(params.testId && client?.id && params.testType && matchedTest),
    staleTime: 30 * 1000, // 30 seconds
  })
}
