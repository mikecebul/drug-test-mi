'use client'

import { useGetEmailPreviewQuery } from '../../../queries'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { FormMedications } from '../../shared-validators'

interface UseInstantTestEmailPreviewParams {
  clientId?: string | null
  testType?: '15-panel-instant' | null
  collectionDate?: string | null
  detectedSubstances?: SubstanceValue[]
  isDilute?: boolean
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
  confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
  medications?: FormMedications
}

/**
 * Hook for instant test email preview - returns both client and referral email data
 * Uses screening email preview (test has results) instead of collection preview
 */
export function useInstantTestEmailPreview({
  clientId,
  testType,
  collectionDate,
  detectedSubstances = [],
  isDilute = false,
  breathalyzerTaken,
  breathalyzerResult,
  confirmationDecision,
  medications,
}: UseInstantTestEmailPreviewParams) {
  const emailPreviewQuery = useGetEmailPreviewQuery({
    clientId,
    testType,
    collectionDate,
    detectedSubstances,
    isDilute,
    breathalyzerTaken,
    breathalyzerResult,
    confirmationDecision,
    medications,
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
