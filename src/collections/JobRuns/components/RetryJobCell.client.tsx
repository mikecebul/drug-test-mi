'use client'

import { useTransition, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import type { DefaultCellComponentProps } from 'payload'
import { useAuth } from '@payloadcms/ui'
import { toast } from 'sonner'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { isRetryableJobTaskSlug } from '@/lib/jobs/retryableTasks'
import type { Admin } from '@/payload-types'

import { retryJobRunAction } from './retryJobRunAction'

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function RetryJobField() {
  return null
}

export default function RetryJobCell({ rowData }: DefaultCellComponentProps) {
  const router = useRouter()
  const { user } = useAuth<Admin>()
  const [isPending, startTransition] = useTransition()
  const jobRunId = readString(rowData.id)
  const status = readString(rowData.status)
  const taskLabel = readString(rowData.taskLabel) || 'job'
  const taskSlug = readString(rowData.taskSlug)

  if (user?.role !== 'superAdmin' || status !== 'failed' || !jobRunId || !isRetryableJobTaskSlug(taskSlug)) {
    return null
  }

  const handleRetry = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (
      !window.confirm(
        `Retry ${taskLabel}? A new queued job will be created and the failed attempt will remain in history.`,
      )
    ) {
      return
    }

    startTransition(async () => {
      const result = await retryJobRunAction(jobRunId)

      if (!result.success) {
        toast.error(result.error || 'Failed to retry job.')
        return
      }

      toast.success(
        result.deduplicated
          ? `${result.taskLabel || taskLabel} is already queued as job ${result.jobId}.`
          : `Queued ${result.taskLabel || taskLabel} as job ${result.jobId}.`,
      )
      router.refresh()
    })
  }

  return (
    <ShadcnWrapper>
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleRetry}>
        <RotateCcw className={isPending ? 'animate-spin' : undefined} />
        {isPending ? 'Queueing…' : 'Retry'}
      </Button>
    </ShadcnWrapper>
  )
}
