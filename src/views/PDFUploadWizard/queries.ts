'use client'

import { useQuery } from '@tanstack/react-query'
import {
  findMatchingClients,
  getAllClients,
  computeTestResultPreview,
  getCollectionEmailPreview,
  getEmailPreview,
  getConfirmationEmailPreview,
  extractPdfData,
  getClients,
} from './actions'
import { getClientFromTestId, getDrugTestWithMedications } from './workflows/components/client/getClients'
import { fetchPendingTests } from './workflows/lab-screen/components/fetchPendingTests'
import type { SubstanceValue } from '@/fields/substanceOptions'
import type { ParsedPDFData, WizardType } from './types'
import type { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'

// Minimal medication interface that both FormMedications and MedicationSnapshot satisfy
type MedicationInput = {
  medicationName: string
  detectedAs?: string[] | null
  [key: string]: any // Allow additional fields from FormMedications
}

// Re-export ParsedPDFData as ExtractedPdfData for clarity in query consumers
export type ExtractedPdfData = ParsedPDFData

/**
 * Query hook for finding matching clients based on donor name
 */
export function useFindMatchingClientsQuery(firstName?: string, lastName?: string, middleInitial?: string) {
  return useQuery({
    queryKey: ['matching-clients', firstName, lastName, middleInitial],
    queryFn: async () => {
      if (!firstName || !lastName) {
        return { matches: [], searchTerm: '' }
      }
      return findMatchingClients(firstName, lastName, middleInitial)
    },
    enabled: Boolean(firstName && lastName),
    staleTime: 30 * 1000, // 30 seconds - clients can be added/deleted frequently
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
    staleTime: 30 * 1000, // 30 seconds - clients can be added/deleted frequently
  })
}
export function useGetClientsQuery() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
    staleTime: 30 * 1000, // 30 seconds - clients can be added/deleted frequently
  })
}

/**
 * Query hook for computing test result preview
 * Accepts medications from both form input (instant tests) and matched test snapshots (lab tests)
 */
export function useComputeTestResultPreviewQuery(
  clientId: string | null | undefined,
  detectedSubstances: SubstanceValue[],
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' | null | undefined,
  breathalyzerTaken?: boolean,
  breathalyzerResult?: number | null,
  medications?: MedicationInput[],
) {
  return useQuery({
    queryKey: [
      'test-result-preview',
      clientId,
      detectedSubstances,
      testType,
      breathalyzerTaken,
      breathalyzerResult,
      medications,
    ],
    queryFn: async () => {
      if (!clientId || !testType) {
        return null
      }
      // Convert medications to MedicationSnapshot format
      const medicationSnapshot: MedicationSnapshot[] | undefined = medications?.map((med) => ({
        medicationName: med.medicationName,
        detectedAs: (med.detectedAs || []) as any, // Cast to bypass strict type checking
      }))
      return computeTestResultPreview(
        clientId,
        detectedSubstances,
        testType,
        breathalyzerTaken,
        breathalyzerResult,
        medicationSnapshot,
      )
    },
    enabled: Boolean(clientId && testType),
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
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
}) {
  const { clientId, testType, collectionDate, breathalyzerTaken, breathalyzerResult } = data

  return useQuery({
    queryKey: ['collection-email-preview', clientId, testType, collectionDate, breathalyzerTaken, breathalyzerResult],
    queryFn: async () => {
      if (!clientId || !testType || !collectionDate) {
        return null
      }
      return getCollectionEmailPreview({
        clientId,
        testType,
        collectionDate,
        breathalyzerTaken,
        breathalyzerResult,
      })
    },
    enabled: Boolean(clientId && testType && collectionDate),
    staleTime: 30 * 1000, // 30 seconds - email previews should be relatively fresh
  })
}

/**
 * Query hook for getting client from test
 * Uses client-side SDK for better type safety and performance
 */
export function useGetClientFromTestQuery(testId: string | null | undefined) {
  return useQuery({
    queryKey: ['client-from-test', testId],
    queryFn: async () => {
      if (!testId) {
        return null
      }
      return getClientFromTestId(testId)
    },
    enabled: Boolean(testId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Query hook for getting drug test with medications snapshot
 * Uses client-side SDK to fetch test data including medicationsAtTestTime
 */
export function useGetDrugTestWithMedicationsQuery(testId: string | null | undefined) {
  return useQuery({
    queryKey: ['drug-test-with-medications', testId],
    queryFn: async () => {
      if (!testId) {
        return null
      }
      return getDrugTestWithMedications(testId)
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
        const message = errorData.error || errorData.message || `Failed to fetch drug test (${response.status})`
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
  medications?: MedicationInput[]
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
    medications,
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
      medications,
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
        medications: medications as any,
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
  adjustedSubstances?: SubstanceValue[] // Optional: substances with confirmed negatives removed
}) {
  const { clientId, testId, confirmationResults, adjustedSubstances } = data

  return useQuery({
    queryKey: ['confirmation-email-preview', clientId, testId, confirmationResults, adjustedSubstances],
    queryFn: async () => {
      if (!clientId || !testId || !confirmationResults || confirmationResults.length === 0) {
        return null
      }
      return getConfirmationEmailPreview({
        clientId,
        testId,
        confirmationResults,
        adjustedSubstances,
      })
    },
    enabled: Boolean(clientId && testId && confirmationResults && confirmationResults.length > 0),
    staleTime: 30 * 1000, // 30 seconds - email previews should be relatively fresh
  })
}

// Query key factory for PDF extraction
export const extractPdfQueryKey = (file: File | null | undefined, wizardType: WizardType) =>
  ['extract-pdf', file?.name, file?.size, file?.lastModified, wizardType] as const

// Shared query function for PDF extraction
const extractPdfQueryFn = async (file: File, wizardType: WizardType) => {
  const formData = new FormData()
  formData.append('file', file)

  const result = await extractPdfData(formData, wizardType)

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
export function useExtractPdfQuery(file: File | null | undefined, wizardType: WizardType) {
  return useQuery({
    queryKey: extractPdfQueryKey(file, wizardType),
    queryFn: async () => {
      if (!file) {
        throw new Error('No file provided')
      }
      return extractPdfQueryFn(file, wizardType)
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
  wizardType: WizardType,
) {
  return queryClient.prefetchQuery({
    queryKey: extractPdfQueryKey(file, wizardType),
    queryFn: () => extractPdfQueryFn(file, wizardType),
    staleTime: Infinity,
  })
}
