'use client'

import { useState } from 'react'
import { CalendarCheck2, CircleAlert, CloudCog, FlaskConical, Loader2, Play } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RandomTestingSyncRuntimeState } from '@/lib/random-testing/runtime'
import {
  checkRandomTestingConnections,
  previewRandomTestingToday,
  queueRandomTestingSync,
  type RandomTestingConnectionCheckResult,
  type RandomTestingPreviewResult,
  type RandomTestingQueueResult,
} from './randomTestingSync'

type PendingAction = 'check' | 'preview' | 'today' | 'upcoming' | null

function LoadingIcon() {
  return <Loader2 data-icon="inline-start" className="animate-spin" />
}

export function RandomTestingSyncWidgetClient({
  canQueue,
  runtime,
}: {
  canQueue: boolean
  runtime: RandomTestingSyncRuntimeState
}) {
  const [pending, setPending] = useState<PendingAction>(null)
  const [connectionCheck, setConnectionCheck] = useState<RandomTestingConnectionCheckResult | null>(null)
  const [preview, setPreview] = useState<RandomTestingPreviewResult | null>(null)
  const [queueResult, setQueueResult] = useState<RandomTestingQueueResult | null>(null)

  const runConnectionCheck = async () => {
    setPending('check')
    setConnectionCheck(await checkRandomTestingConnections())
    setPending(null)
  }

  const runPreview = async () => {
    setPending('preview')
    setPreview(await previewRandomTestingToday())
    setPending(null)
  }

  const queueSync = async (kind: 'today' | 'upcoming') => {
    setPending(kind)
    setQueueResult(await queueRandomTestingSync(kind))
    setPending(null)
  }

  const writesDisabled =
    pending !== null || !canQueue || !runtime.enabled || !runtime.configured || connectionCheck?.success !== true

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={runtime.configured ? 'success' : 'destructive'}>
          {runtime.configured ? 'Credentials configured' : 'Configuration incomplete'}
        </Badge>
        <Badge variant={runtime.enabled ? 'warning' : 'outline'}>
          Calendar writes {runtime.enabled ? 'enabled' : 'disabled'}
        </Badge>
      </div>

      {runtime.missing.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Missing production settings</AlertTitle>
          <AlertDescription>
            <p>{runtime.missing.join(', ')}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={runConnectionCheck} disabled={pending !== null}>
          {pending === 'check' ? <LoadingIcon /> : <CloudCog data-icon="inline-start" />}
          Check Connections
        </Button>
        <Button type="button" variant="outline" onClick={runPreview} disabled={pending !== null}>
          {pending === 'preview' ? <LoadingIcon /> : <FlaskConical data-icon="inline-start" />}
          Preview Today
        </Button>
        <Button type="button" onClick={() => queueSync('upcoming')} disabled={writesDisabled}>
          {pending === 'upcoming' ? <LoadingIcon /> : <CalendarCheck2 data-icon="inline-start" />}
          Queue Upcoming Holds
        </Button>
        <Button type="button" onClick={() => queueSync('today')} disabled={writesDisabled}>
          {pending === 'today' ? <LoadingIcon /> : <Play data-icon="inline-start" />}
          Queue Today&apos;s Sync
        </Button>
      </div>

      {!canQueue && (
        <p className="text-muted-foreground text-xs">A super-admin is required to queue calendar-writing jobs.</p>
      )}
      {!runtime.enabled && (
        <p className="text-muted-foreground text-xs">
          Connection checks and previews are read-only. Enable the write kill switch only after both pass.
        </p>
      )}
      {runtime.enabled && connectionCheck?.success !== true && (
        <p className="text-muted-foreground text-xs">
          Run a successful connection check before manually queueing either production sync.
        </p>
      )}

      {connectionCheck && (
        <Alert variant={connectionCheck.success ? 'success' : 'warning'}>
          {connectionCheck.success ? <CalendarCheck2 /> : <CircleAlert />}
          <AlertTitle>{connectionCheck.success ? 'All connections passed' : 'One or more checks failed'}</AlertTitle>
          <AlertDescription>
            {connectionCheck.services.length === 0 ? (
              <p>{connectionCheck.error || 'The connection check could not run.'}</p>
            ) : (
              connectionCheck.services.map((service) => (
                <p key={service.name}>
                  <strong>{service.name}:</strong> {service.success ? 'Passed' : 'Failed'} — {service.detail}
                </p>
              ))
            )}
          </AlertDescription>
        </Alert>
      )}

      {preview && (
        <Alert variant={preview.success ? 'info' : 'destructive'}>
          {preview.success ? <FlaskConical /> : <CircleAlert />}
          <AlertTitle>
            {preview.success
              ? `${preview.collections?.length || 0} scheduled collection${preview.collections?.length === 1 ? '' : 's'} today`
              : 'Today’s preview failed'}
          </AlertTitle>
          <AlertDescription>
            {preview.error && <p>{preview.error}</p>}
            {preview.collections?.length === 0 && <p>ToxAccess has no scheduled collections for today.</p>}
            {preview.collections?.map((collection) => (
              <p key={collection.collectionKey}>
                {collection.donorName} ({collection.donorId}) — {collection.status}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {queueResult && (
        <Alert variant={queueResult.success ? 'success' : 'destructive'}>
          {queueResult.success ? <CalendarCheck2 /> : <CircleAlert />}
          <AlertTitle>{queueResult.success ? 'Sync queued' : 'Sync was not queued'}</AlertTitle>
          <AlertDescription>
            {queueResult.error && <p>{queueResult.error}</p>}
            {queueResult.jobId && (
              <p>
                Job {queueResult.jobId}
                {queueResult.deduplicated ? ' was already waiting or running.' : ' is ready for the Redwood worker.'}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
