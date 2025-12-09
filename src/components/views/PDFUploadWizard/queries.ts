'use client'

import { useQuery } from '@tanstack/react-query'
import {
  findMatchingClients,
  getAllClients,
  getClientMedications,
  computeTestResultPreview,
  fetchPendingTests,
  getCollectionEmailPreview,
  getClientFromTest,
  getEmailPreview,
  getConfirmationEmailPreview,
  extractPdfData,
} from './actions'
import type { SubstanceValue } from '@/fields/substanceOptions'
import type { ParsedPDFData } from './types'

// Re-export ParsedPDFData as ExtractedPdfData for clarity in query consumers
export type ExtractedPdfData = ParsedPDFData

/**
 * Query hook for finding matching clients based on donor name
 */
export function useFindMatchingClientsQuery(
  firstName?: string,
  lastName?: string,
  middleInitial?: string,
) {
  return useQuery({
    queryKey: ['matching-clients', firstName, lastName, middleInitial],
    queryFn: async () => {
      if (!firstName || !lastName) {
        return { matches: [], searchTerm: '' }
      }
      return findMatchingClients(firstName, lastName, middleInitial)
    },
    enabled: Boolean(firstName && lastName),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Query hook for getting all clients
 */
export function useGetAllClientsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: ['all-clients'],
    queryFn: getAllClients,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Query hook for getting client medications
 */
export function useGetClientMedicationsQuery(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['client-medications', clientId],
    queryFn: async () => {
      if (!clientId) {
        return { medications: [] }
      }
      const result = await getClientMedications(clientId)
      if (!result.success) {
        throw new Error(result.error)
      }
      return { medications: result.medications }
    },
    enabled: Boolean(clientId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Query hook for computing test result preview
 */
export function useComputeTestResultPreviewQuery(
  clientId: string | null | undefined,
  detectedSubstances: SubstanceValue[],
  breathalyzerTaken?: boolean,
  breathalyzerResult?: number | null,
) {
  return useQuery({
    queryKey: [
      'test-result-preview',
      clientId,
      detectedSubstances,
      breathalyzerTaken,
      breathalyzerResult,
    ],
    queryFn: async () => {
      if (!clientId) {
        return null
      }
      return computeTestResultPreview(
        clientId,
        detectedSubstances,
        breathalyzerTaken,
        breathalyzerResult,
      )
    },
    enabled: Boolean(clientId),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

/**
 * Query hook for fetching pending drug tests
 */
export function useFetchPendingTestsQuery(filterStatus?: string[]) {
  return useQuery({
    queryKey: ['pending-tests', filterStatus],
    queryFn: async () => {
      const result = await fetchPendingTests(filterStatus)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.tests
    },
    staleTime: 1 * 60 * 1000, // 1 minute - tests can be added/updated frequently
  })
}

/**
 * Query hook for getting collection email preview
 */
export function useGetCollectionEmailPreviewQuery(data: {
  clientId: string | null | undefined
  testType: '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | null | undefined
  collectionDate: string | null | undefined
  collectionTime: string | null | undefined
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
}) {
  const {
    clientId,
    testType,
    collectionDate,
    collectionTime,
    breathalyzerTaken,
    breathalyzerResult,
  } = data

  return useQuery({
    queryKey: [
      'collection-email-preview',
      clientId,
      testType,
      collectionDate,
      collectionTime,
      breathalyzerTaken,
      breathalyzerResult,
    ],
    queryFn: async () => {
      if (!clientId || !testType || !collectionDate || !collectionTime) {
        return null
      }
      return getCollectionEmailPreview({
        clientId,
        testType,
        collectionDate,
        collectionTime,
        breathalyzerTaken,
        breathalyzerResult,
      })
    },
    enabled: Boolean(clientId && testType && collectionDate && collectionTime),
    staleTime: 30 * 1000, // 30 seconds - email previews should be relatively fresh
  })
}

/**
 * Query hook for getting client from test
 */
export function useGetClientFromTestQuery(testId: string | null | undefined) {
  return useQuery({
    queryKey: ['client-from-test', testId],
    queryFn: async () => {
      if (!testId) {
        return null
      }
      const result = await getClientFromTest(testId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to get client from test')
      }
      return result.client ?? null
    },
    enabled: Boolean(testId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Query hook for getting drug test details by ID
 * This fetches the full test data including screening results
 */
export function useGetDrugTestQuery(testId: string | null | undefined) {
  return useQuery({
    queryKey: ['drug-test', testId],
    queryFn: async () => {
      if (!testId) {
        return null
      }
      const response = await fetch(`/api/drug-tests/${testId}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const message =
          errorData.error || errorData.message || `Failed to fetch drug test (${response.status})`
        throw new Error(message)
      }
      return response.json()
    },
    enabled: Boolean(testId),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

/**
 * Query hook for getting email preview (screening results)
 */
export function useGetEmailPreviewQuery(data: {
  clientId: string | null | undefined
  detectedSubstances: SubstanceValue[]
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | null | undefined
  collectionDate: string | null | undefined
  isDilute: boolean
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
  confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
}) {
  const {
    clientId,
    detectedSubstances,
    testType,
    collectionDate,
    isDilute,
    breathalyzerTaken,
    breathalyzerResult,
    confirmationDecision,
  } = data

  return useQuery({
    queryKey: [
      'email-preview',
      clientId,
      detectedSubstances,
      testType,
      collectionDate,
      isDilute,
      breathalyzerTaken,
      breathalyzerResult,
      confirmationDecision,
    ],
    queryFn: async () => {
      if (!clientId || !testType || !collectionDate) {
        return null
      }
      return getEmailPreview({
        clientId,
        detectedSubstances,
        testType,
        collectionDate,
        isDilute,
        breathalyzerTaken,
        breathalyzerResult,
        confirmationDecision,
      })
    },
    enabled: Boolean(clientId && testType && collectionDate),
    staleTime: 30 * 1000, // 30 seconds - email previews should be relatively fresh
  })
}

/**
 * Query hook for getting confirmation email preview
 */
export function useGetConfirmationEmailPreviewQuery(data: {
  clientId: string | null | undefined
  testId: string | null | undefined
  confirmationResults: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
}) {
  const { clientId, testId, confirmationResults } = data

  return useQuery({
    queryKey: ['confirmation-email-preview', clientId, testId, confirmationResults],
    queryFn: async () => {
      if (!clientId || !testId || !confirmationResults || confirmationResults.length === 0) {
        return null
      }
      return getConfirmationEmailPreview({
        clientId,
        testId,
        confirmationResults,
      })
    },
    enabled: Boolean(clientId && testId && confirmationResults && confirmationResults.length > 0),
    staleTime: 30 * 1000, // 30 seconds - email previews should be relatively fresh
  })
}

// Query key factory for PDF extraction
export const extractPdfQueryKey = (
  file: File | null | undefined,
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | undefined,
) => ['extract-pdf', file?.name, file?.size, file?.lastModified, testType] as const

// Shared query function for PDF extraction
const extractPdfQueryFn = async (
  file: File,
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | undefined,
) => {
  const formData = new FormData()
  formData.append('file', file)

  const result = await extractPdfData(formData, testType)

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to extract PDF data')
  }

  return result.data
}

/**
 * Query hook for extracting PDF data
 * Automatically extracts when file is uploaded and caches the result
 * Invalidates and re-extracts when file changes
 */
export function useExtractPdfQuery(
  file: File | null | undefined,
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | undefined,
) {
  return useQuery({
    queryKey: extractPdfQueryKey(file, testType),
    queryFn: async () => {
      if (!file) {
        throw new Error('No file provided')
      }
      return extractPdfQueryFn(file, testType)
    },
    enabled: Boolean(file), // Only run when file exists
    staleTime: Infinity, // Extracted data never goes stale (file content won't change)
    retry: 1, // Only retry once on failure
  })
}

/**
 * Prefetch PDF extraction - call this to trigger extraction early
 * Results will be cached and available to useExtractPdfQuery
 */
export function prefetchExtractPdf(
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>,
  file: File,
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | undefined,
) {
  return queryClient.prefetchQuery({
    queryKey: extractPdfQueryKey(file, testType),
    queryFn: () => extractPdfQueryFn(file, testType),
    staleTime: Infinity,
  })
}
