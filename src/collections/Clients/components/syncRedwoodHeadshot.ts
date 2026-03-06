'use server'

import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { queueRedwoodHeadshotSync } from '@/lib/redwood/queue'

export async function syncRedwoodHeadshot(
  clientId: string,
): Promise<{
  success: boolean
  queued?: boolean
  jobId?: string
  error?: string
  errorCode?: string
}> {
  const payload = await getPayload({ config: configPromise })

  try {
    if (!clientId) {
      return {
        success: false,
        error: 'Client ID is required',
        errorCode: 'INVALID_INPUT',
      }
    }

    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins') {
      return {
        success: false,
        error: 'Unauthorized: Admin access required',
        errorCode: 'UNAUTHORIZED',
      }
    }

    const queued = await queueRedwoodHeadshotSync(clientId, String(user.id), payload)

    return {
      success: true,
      queued: true,
      jobId: queued.jobId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    payload.logger.error({
      msg: '[syncRedwoodHeadshot] Failed to queue Redwood headshot sync',
      clientId,
      error: message,
    })

    return {
      success: false,
      error: message,
      errorCode: 'QUEUE_FAILED',
    }
  }
}
