'use client'

import { useGetCollectionEmailPreviewQuery } from '../../../queries'

interface UseEmailPreviewParams {
  clientId?: string | null
  testType?: '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | '15-panel-instant' | null
  collectionDate?: string | null
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
}

export function useEmailPreview({
  clientId,
  testType,
  collectionDate,
  breathalyzerTaken,
  breathalyzerResult,
}: UseEmailPreviewParams) {
  const emailPreviewQuery = useGetCollectionEmailPreviewQuery({
    clientId,
    testType: testType as '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | null | undefined,
    collectionDate,
    breathalyzerTaken,
    breathalyzerResult,
  })

  const previewData = emailPreviewQuery.data?.data ?? null
  const isLoading = emailPreviewQuery.isLoading
  const error = emailPreviewQuery.error
    ? emailPreviewQuery.error instanceof Error
      ? emailPreviewQuery.error.message
      : 'Failed to load email preview'
    : !clientId || !collectionDate
      ? 'Missing client or collection data'
      : null

  return {
    previewData,
    isLoading,
    error,
  }
}
