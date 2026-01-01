'use client'

import { sdk } from '@/lib/payload-sdk'

export async function fetchPendingTests(filterStatus?: string[]): Promise<
  | {
      success: true
      tests: {
        id: string
        clientName: string
        testType: string
        collectionDate: string
        screeningStatus: string
        clientHeadshot?: string | null
        breathalyzerTaken: boolean
        breathalyzerResult: number | null
      }[]
    }
  | { success: false; error: string }
> {
  try {
    // Build where clause based on status filter
    let whereClause: any = {}

    if (filterStatus && filterStatus.length > 0) {
      whereClause = {
        screeningStatus: {
          in: filterStatus,
        },
      }
    } else {
      // Default: only show collected or screened tests (not complete)
      whereClause = {
        screeningStatus: {
          in: ['collected', 'screened', 'confirmation-pending'],
        },
      }
    }

    // Fetch pending drug tests
    const result = await sdk.find({
      collection: 'drug-tests',
      where: whereClause,
      sort: '-collectionDate',
      limit: 50,
      depth: 2, // Depth 2 needed to populate relatedClient.headshot
    })

    // Map to simplified format
    return {
      success: true,
      tests: result.docs.map((test) => {
        // Extract client headshot if available
        const client = typeof test.relatedClient === 'object' ? test.relatedClient : null
        const clientHeadshot =
          client && typeof client.headshot === 'object' && client.headshot
            ? client.headshot.sizes?.thumbnail?.url || client.headshot.url || null
            : null

        return {
          id: test.id,
          clientName: test.clientName || 'Unknown',
          testType: test.testType,
          collectionDate: test.collectionDate || '',
          screeningStatus: test.screeningStatus,
          clientHeadshot,
          breathalyzerTaken: test.breathalyzerTaken || false,
          breathalyzerResult: test.breathalyzerResult || null,
        }
      }),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pending tests',
    }
  }
}
