'use server'

import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { recordCancelledJobRun } from '@/lib/jobs/jobRuns'

export async function cancelPayloadJobAction(jobId: string): Promise<{ success: boolean; error?: string }> {
  const payload = await getPayload({ config: configPromise })

  try {
    if (!jobId.trim()) {
      return {
        success: false,
        error: 'Job ID is required.',
      }
    }

    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins' || user.role !== 'superAdmin') {
      return {
        success: false,
        error: 'Unauthorized: super-admin access required.',
      }
    }

    const jobRecord = await payload
      .findByID({
        collection: 'payload-jobs',
        id: jobId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)

    await payload.jobs.cancelByID({
      id: jobId,
      overrideAccess: true,
    })

    await recordCancelledJobRun(payload, {
      cancelledByAdminId: String(user.id),
      job: jobRecord,
      jobId,
    })

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel job.'

    payload.logger.error({
      msg: '[cancelPayloadJobAction] Failed to cancel Payload job',
      jobId,
      error: message,
    })

    return {
      success: false,
      error: message,
    }
  }
}
