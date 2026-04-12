'use client'

import { useTransition } from 'react'
import { ChevronDown, Loader2, RefreshCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getRedwoodClientUpdateFieldLabel } from '../redwoodSyncFields'
import { clearPendingRedwoodClientSync } from './clearPendingRedwoodClientSync'
import { queuePendingRedwoodClientSync } from './queuePendingRedwoodClientSync'
import { useRedwoodClientSyncState } from './useRedwoodClientSyncState'

interface SyncPendingRedwoodClientChangesButtonClientProps {
  clientId: string
}

export function SyncPendingRedwoodClientChangesButtonClient({ clientId }: SyncPendingRedwoodClientChangesButtonClientProps) {
  const [isQueuePending, startQueueTransition] = useTransition()
  const [isClearPending, startClearTransition] = useTransition()
  const { eligible, pendingFields, pendingSyncMode, refreshState } = useRedwoodClientSyncState()
  const pendingFieldLabels = pendingFields.map((field) => getRedwoodClientUpdateFieldLabel(field))
  const syncDisabled = isQueuePending || isClearPending || pendingSyncMode === 'queued'
  const clearDisabled = isQueuePending || isClearPending || pendingSyncMode === 'queued'

  if (!eligible || pendingFields.length === 0) {
    return null
  }

  const handleQueue = () => {
    if (syncDisabled) {
      return
    }

    startQueueTransition(async () => {
      const result = await queuePendingRedwoodClientSync(clientId)

      if (!result.success) {
        toast.error(result.error || 'Failed to queue pending Redwood sync')
        await refreshState()
        return
      }

      toast.success(
        result.jobId ? `Pending Redwood sync queued (job ${result.jobId})` : 'Pending Redwood sync queued',
      )
      await refreshState()
    })
  }

  const handleClear = () => {
    if (clearDisabled) {
      return
    }

    startClearTransition(async () => {
      const result = await clearPendingRedwoodClientSync(clientId)

      if (!result.success) {
        toast.error(result.error || 'Failed to clear pending Redwood sync state')
        await refreshState()
        return
      }

      const clearedCount = result.clearedFields?.length || 0
      toast.success(
        clearedCount > 0
          ? `Cleared ${clearedCount} pending Redwood ${clearedCount === 1 ? 'change' : 'changes'}`
          : 'Pending Redwood changes were already clear',
      )
      await refreshState()
    })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <ButtonGroup>
        <Button type="button" variant="outline" onClick={handleQueue} disabled={syncDisabled} className="gap-2">
          {isQueuePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          <span>Sync Pending Redwood Changes</span>
          <Badge variant={pendingSyncMode === 'queued' ? 'secondary' : 'outline'} className="min-w-5 px-1.5">
            {pendingFields.length}
          </Badge>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="View pending Redwood changes">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 rounded-xl p-0">
            <div className="space-y-4 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Pending Redwood Changes</p>
                  <Badge variant={pendingSyncMode === 'queued' ? 'secondary' : 'outline'}>{pendingFields.length}</Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-6">
                  {pendingSyncMode === 'queued'
                    ? 'A Redwood client sync is already queued. New saved Redwood edits will stay pending until the current job finishes.'
                    : 'Saved Redwood-backed changes waiting to sync to Redwood. If Redwood already matches, clear the stale pending state here.'}
                </p>
              </div>

              <div className="space-y-2">
                {pendingFieldLabels.map((label) => (
                  <div
                    key={label}
                    className="bg-muted/40 text-foreground flex items-center rounded-lg border px-3 py-2 text-sm"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end border-t pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={clearDisabled}
                  className="gap-2"
                >
                  {isClearPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Clear Pending State
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </ButtonGroup>
    </ShadcnWrapper>
  )
}
