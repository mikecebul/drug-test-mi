'use server'

import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { retryFailedJobRun } from '@/lib/jobs/retryFailedJobRun'

export type RetryJobRunActionResult = {
  deduplicated?: boolean
  error?: string
  jobId?: string
  success: boolean
  taskLabel?: string
}

export async function retryJobRunAction(jobRunId: string): Promise<RetryJobRunActionResult> {
  const payload = await getPayload({ config: configPromise })

  try {
    if (!jobRunId.trim()) {
      return {
        success: false,
        error: 'Job History ID is required.',
      }
    }

    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user || user.collection !== 'admins' || user.role !== 'superAdmin') {
      return {
        success: false,
        error: 'Unauthorized: super-admin access required to retry jobs.',
      }
    }

    const result = await retryFailedJobRun({
      jobRunId,
      payload,
      requestedByAdminId: String(user.id),
    })

    return {
      ...result,
      success: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retry job.'

    payload.logger.error({
      msg: '[retryJobRunAction] Failed to retry Payload job',
      jobRunId,
      err: error,
    })

    return {
      success: false,
      error: message,
    }
  }
}
