'use client'

import { useEffect, useState, useTransition } from 'react'
import { Activity, CheckCircle2, CircleAlert, Loader2, Play, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getRedwoodQueueProbeStatus, queueRedwoodQueueProbe, type RedwoodQueueProbeResult } from './redwoodQueueProbe'

const TERMINAL_PHASES = new Set(['cancelled', 'failed', 'missing', 'succeeded'])

function getStatusVariant(result: RedwoodQueueProbeResult): 'destructive' | 'info' | 'success' | 'warning' {
  if (!result.success || result.phase === 'cancelled' || result.phase === 'failed' || result.phase === 'missing') {
    return 'destructive'
  }
  if (result.phase === 'succeeded') return 'success'
  if (result.phase === 'running') return 'warning'
  return 'info'
}

export function RedwoodQueueProbeWidgetClient() {
  const [result, setResult] = useState<RedwoodQueueProbeResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const refreshStatus = () => {
    const jobId = result?.jobId
    if (!jobId) return

    startTransition(async () => {
      setResult(await getRedwoodQueueProbeStatus(jobId))
    })
  }

  useEffect(() => {
    const jobId = result?.jobId
    if (!jobId || !result.phase || TERMINAL_PHASES.has(result.phase)) return

    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        setResult(await getRedwoodQueueProbeStatus(jobId))
      })
    }, 1500)

    return () => window.clearTimeout(timeout)
  }, [result?.jobId, result?.phase])

  const runProbe = () => {
    startTransition(async () => {
      setResult(await queueRedwoodQueueProbe())
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={runProbe} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Run Queue Probe
        </Button>
        {result?.jobId && (
          <Button type="button" variant="outline" onClick={refreshStatus} disabled={isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Status
          </Button>
        )}
      </div>

      {result && (
        <Alert variant={getStatusVariant(result)}>
          {result.phase === 'succeeded' ? <CheckCircle2 /> : result.success ? <Activity /> : <CircleAlert />}
          <AlertTitle>{result.success ? `Probe ${result.phase || 'status'}` : 'Probe failed to queue'}</AlertTitle>
          <AlertDescription>
            {result.error && <p>{result.error}</p>}
            {result.summary && <p>{result.summary}</p>}
            {result.jobId && <p>Job ID: {result.jobId}</p>}
            {result.probeId && <p>Probe ID: {result.probeId}</p>}
            {result.webHostname && <p>Website container: {result.webHostname}</p>}
            {result.workerHostname && <p>Worker container: {result.workerHostname}</p>}
            {result.processedAt && <p>Processed: {new Date(result.processedAt).toLocaleString()}</p>}
            {typeof result.automationEnabled === 'boolean' && (
              <p>
                Website runtime flag: {result.automationEnabled ? 'enabled' : 'disabled'}
                {result.automationConfiguredValue ? ` (${result.automationConfiguredValue})` : ' (not configured)'}
              </p>
            )}
            {typeof result.webRuntimeReady === 'boolean' && (
              <p>Website runtime readiness: {result.webRuntimeReady ? 'ready' : 'not ready'}</p>
            )}
            {result.webMissingEnvironmentVariables && result.webMissingEnvironmentVariables.length > 0 && (
              <p>Website missing environment variables: {result.webMissingEnvironmentVariables.join(', ')}</p>
            )}
            {typeof result.workerAutomationEnabled === 'boolean' && (
              <p>
                Worker runtime flag: {result.workerAutomationEnabled ? 'enabled' : 'disabled'}
                {result.workerAutomationConfiguredValue
                  ? ` (${result.workerAutomationConfiguredValue})`
                  : ' (not configured)'}
              </p>
            )}
            {typeof result.workerRuntimeReady === 'boolean' && (
              <p>Worker runtime readiness: {result.workerRuntimeReady ? 'ready' : 'not ready'}</p>
            )}
            {result.workerMissingEnvironmentVariables && result.workerMissingEnvironmentVariables.length > 0 && (
              <p>Worker missing environment variables: {result.workerMissingEnvironmentVariables.join(', ')}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <p className="text-muted-foreground text-xs">
        This probe only tests website → MongoDB queue → worker execution. It does not sign in to or modify ToxAccess.
      </p>
    </div>
  )
}
