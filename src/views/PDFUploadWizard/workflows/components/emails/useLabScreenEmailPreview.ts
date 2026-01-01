import { useQuery } from '@tanstack/react-query'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { getEmailPreview } from '../../../actions'
import { useGetClientFromTestQuery } from '../../../queries'

interface UseLabScreenEmailPreviewParams {
  testId?: string
  testType?: string
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
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

  // Then fetch email preview with client medications
  return useQuery<EmailPreviewData>({
    queryKey: [
      'lab-screen-email-preview',
      params.testId,
      client?.id,
      params.detectedSubstances,
      params.isDilute,
      params.breathalyzerTaken,
      params.breathalyzerResult,
    ],
    queryFn: async () => {
      if (!client?.id || !params.testType) {
        return {
          referralEmails: [],
          referralTitle: 'Screening Results',
          referralHtml: '<p>Loading email preview...</p>',
          referralSubject: 'Lab Screening Results',
        }
      }

      // Get collection date from the existing test
      const testResponse = await fetch(`/api/drug-tests/${params.testId}`)
      if (!testResponse.ok) {
        throw new Error('Failed to fetch test data')
      }
      const testData = await testResponse.json()
      const collectionDate = testData.collectionDate || new Date().toISOString()

      // Call the server action to generate email preview
      const result = await getEmailPreview({
        clientId: client.id,
        detectedSubstances: params.detectedSubstances,
        testType: params.testType as '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab',
        collectionDate,
        isDilute: params.isDilute,
        breathalyzerTaken: params.breathalyzerTaken,
        breathalyzerResult: params.breathalyzerResult,
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
    enabled: Boolean(params.testId && client?.id && params.testType),
    staleTime: 30 * 1000, // 30 seconds
  })
}
