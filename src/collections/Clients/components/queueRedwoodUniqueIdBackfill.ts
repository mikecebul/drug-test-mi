'use server'

import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { queueRedwoodUniqueIdBackfill } from '@/lib/redwood/queue'

export async function queueRedwoodUniqueIdBackfillAction(
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

    if (!user || user.collection !== 'admins' || user.role !== 'superAdmin') {
      return {
        success: false,
        error: 'Unauthorized: Super admin access required',
        errorCode: 'UNAUTHORIZED',
      }
    }

    const queued = await queueRedwoodUniqueIdBackfill(clientId, String(user.id), payload)

    return {
      success: true,
      queued: true,
      jobId: queued.jobId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    payload.logger.error({
      msg: '[queueRedwoodUniqueIdBackfillAction] Failed to queue Redwood unique ID backfill',
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
