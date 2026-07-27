'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock3, Loader2, RefreshCw, SquareX } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cancelPayloadJobAction } from './cancelPayloadJob'

export type ActiveDashboardJob = {
  ageLabel: string
  clientId?: string
  createdAt: string
  id: string
  processing: boolean
  queue: string
  requestedByAdminId?: string
  taskLabel: string
  taskSlug: string
  totalTried?: number | null
}

export function ActiveJobsWidgetClient({ canCancel, jobs }: { canCancel: boolean; jobs: ActiveDashboardJob[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleRefresh = () => {
    router.refresh()
  }

  const handleCancel = (job: ActiveDashboardJob) => {
    if (!canCancel) {
      return
    }

    const confirmed = window.confirm(
      `Cancel ${job.taskLabel} (${job.id})? This only affects the queued or running job record.`,
    )

    if (!confirmed) {
      return
    }

    startTransition(async () => {
      const result = await cancelPayloadJobAction(job.id)

      if (!result.success) {
        toast.error(result.error || 'Failed to cancel job.')
        return
      }

      toast.success(`Cancelled job ${job.id}.`)
      router.refresh()
    })
  }

  if (jobs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="border-border/80 bg-background/60 text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          No queued or running jobs right now.
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="border-border/70 bg-background/70 rounded-xl border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={job.processing ? 'default' : 'outline'}>
                    {job.processing ? 'Running' : 'Queued'}
                  </Badge>
                  <Badge variant="secondary">{job.queue}</Badge>
                  <p className="text-sm font-semibold">{job.taskLabel}</p>
                </div>

                <div className="text-muted-foreground grid gap-1 text-sm">
                  <p>Job ID: {job.id}</p>
                  {job.clientId && <p>Client: {job.clientId}</p>}
                  {job.requestedByAdminId && <p>Requested by admin: {job.requestedByAdminId}</p>}
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{job.ageLabel}</span>
                    {typeof job.totalTried === 'number' && job.totalTried > 0 && <span>Attempt {job.totalTried}</span>}
                  </div>
                </div>
              </div>

              {canCancel ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleCancel(job)}
                >
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SquareX className="mr-2 h-4 w-4" />}
                  Cancel
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs">Super-admin required to cancel</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
