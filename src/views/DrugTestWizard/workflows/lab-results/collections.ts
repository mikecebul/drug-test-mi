'use client'
import type { DrugTest } from '@/payload-types'
import type { Where } from 'payload'
import { useQuery } from '@tanstack/react-query'
import { sdk } from '@/lib/payload-sdk'
import { eligibleLabCollection, type ReportType } from './model'
import type { ParsedPDFData } from '../../types'

export type LabCollection = Pick<
  DrugTest,
  'id' | 'clientName' | 'testType' | 'collectionDate' | 'screeningStatus' | 'confirmationDecision' | 'relatedClient'
>

export function useLabCollections(report: ParsedPDFData | undefined, type: ReportType, clientId: string | null) {
  return useQuery({
    queryKey: ['lab-entry-collections', report?.reportKind, type, clientId],
    enabled: Boolean(report),
    queryFn: async () => {
      const awaitingConfirmation: Where = {
        and: [
          { screeningStatus: { in: ['screened', 'confirmation-pending'] } },
          { confirmationDecision: { equals: 'request-confirmation' } },
        ],
      }
      const awaitingScreen: Where = { screeningStatus: { equals: 'collected' } }
      const stages: Where =
        type === 'confirmation' || report?.reportKind === 'confirmation'
          ? awaitingConfirmation
          : type === 'screening' || report?.hasConfirmation !== true
            ? awaitingScreen
            : { or: [awaitingScreen, awaitingConfirmation] }
      const result = await sdk.find({
        collection: 'drug-tests',
        depth: 0,
        limit: 100,
        sort: '-collectionDate',
        select: {
          id: true,
          relatedClient: true,
          clientName: true,
          testType: true,
          collectionDate: true,
          screeningStatus: true,
          confirmationDecision: true,
        },
        where: {
          and: [stages, ...(clientId ? [{ relatedClient: { equals: clientId } }] : [])],
        },
      })
      return result.docs.filter((test) => eligibleLabCollection(test, type, report))
    },
    refetchOnMount: 'always',
    staleTime: 0,
  })
}
