'use client'
import { useQuery } from '@tanstack/react-query'
import { sdk } from '@/lib/payload-sdk'
import type { ReportType } from './model'
import type { ParsedPDFData } from '../../types'
import { loadLabCollections } from './loadLabCollections'
export type { LabCollection } from './loadLabCollections'

export function useLabConfirmationCredit(clientId?: string) {
  return useQuery({
    queryKey: ['lab-confirmation-credit', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const client = await sdk.findByID({
        collection: 'clients',
        id: clientId!,
        depth: 0,
        select: { creditBalance: true },
      })
      return Math.max(0, client.creditBalance ?? 0)
    },
    staleTime: 0,
  })
}

export function useLabCollections(report: ParsedPDFData | undefined, type: ReportType) {
  return useQuery({
    queryKey: ['lab-entry-collections', report?.reportKind, type],
    enabled: Boolean(report),
    queryFn: () => loadLabCollections(report, type),
    refetchOnMount: 'always',
    staleTime: 0,
  })
}
