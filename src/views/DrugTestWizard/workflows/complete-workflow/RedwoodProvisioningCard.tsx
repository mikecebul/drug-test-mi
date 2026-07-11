'use client'

import {
  CheckCircle2,
  Circle,
  CircleAlert,
  ExternalLink,
  Loader2,
  RefreshCcw,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/utilities/cn'
import type { GuidedRedwoodProvisioningStatus } from './actions'

type Props = {
  isLoading: boolean
  isRetrying: boolean
  onRetry: () => void
  status?: GuidedRedwoodProvisioningStatus
}

function getStepBadge(status: GuidedRedwoodProvisioningStatus['steps'][number]['status']) {
  if (status === 'complete') return { label: 'Complete', variant: 'success' as const }
  if (status === 'skipped') return { label: 'Not needed', variant: 'secondary' as const }
  if (status === 'failed') return { label: 'Failed', variant: 'destructive' as const }
  if (status === 'manual-review') return { label: 'Review', variant: 'warning' as const }
  if (status === 'running') return { label: 'Working', variant: 'default' as const }
  return { label: 'Waiting', variant: 'outline' as const }
}

function getCardCopy(status?: GuidedRedwoodProvisioningStatus) {
  if (!status) {
    return {
      title: 'Checking ToxAccess donor status',
      description: 'Loading the latest automation status.',
    }
  }

  if (status.overallStatus === 'ready' || status.overallStatus === 'ready-with-warnings') {
    return {
      title: 'Donor ready in ToxAccess',
      description: status.donorId
        ? `Verified donor ${status.donorId}. You can continue to physical collection.`
        : 'The donor is verified. You can continue to physical collection.',
    }
  }

  if (status.overallStatus === 'failed' || status.overallStatus === 'manual-review') {
    return {
      title: 'Automatic donor setup needs help',
      description: 'Retry verification, or create/update the donor manually in ToxAccess and then retry.',
    }
  }

  if (status.overallStatus === 'disabled') {
    return {
      title: 'ToxAccess automation is disabled',
      description: 'Create the donor manually, then ask a server administrator to enable the Redwood worker.',
    }
  }

  return {
    title: 'Creating donor in ToxAccess',
    description: 'Checking for an existing donor, creating one if needed, and applying lab defaults. Usually 1–20 seconds.',
  }
}

export function RedwoodProvisioningCard({ isLoading, isRetrying, onRetry, status }: Props) {
  const copy = getCardCopy(status)
  const completedSteps = status?.steps.filter((step) => step.status === 'complete' || step.status === 'skipped').length ?? 0
  const progress = status ? Math.round((completedSteps / status.steps.length) * 100) : 8
  const defaultTestNeedsManualHelp = status?.steps.some(
    (step) =>
      step.id === 'default-test' && (step.status === 'failed' || step.status === 'manual-review'),
  )
  const needsManualHelp =
    status?.overallStatus === 'disabled' ||
    status?.overallStatus === 'failed' ||
    status?.overallStatus === 'manual-review' ||
    status?.steps.some((step) => step.status === 'failed' || step.status === 'manual-review')
  const TitleIcon = status?.canContinue ? CheckCircle2 : needsManualHelp ? CircleAlert : Loader2

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-2xl">
          <TitleIcon
            className={cn(
              'size-6',
              status?.canContinue && 'text-success',
              !status?.canContinue && !needsManualHelp && 'animate-spin',
            )}
          />
          {copy.title}
        </CardTitle>
        <CardDescription className="text-base">{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Progress value={progress} aria-label="ToxAccess donor setup progress" />

        <div className="flex flex-col gap-3">
          {(status?.steps || []).map((step) => {
            const badge = getStepBadge(step.status)
            const StepIcon =
              step.status === 'complete'
                ? CheckCircle2
                : step.status === 'failed' || step.status === 'manual-review'
                  ? CircleAlert
                  : step.status === 'running'
                    ? Loader2
                    : Circle

            return (
              <div key={step.id} className="border-border bg-background flex items-start gap-3 rounded-lg border p-4">
                <StepIcon className={cn('mt-0.5 size-5 shrink-0', step.status === 'running' && 'animate-spin')} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{step.label}</p>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{step.message}</p>
                </div>
              </div>
            )
          })}
        </div>

        {status?.overallStatus === 'ready-with-warnings' && (
          <Alert variant="warning">
            <CircleAlert />
            <AlertTitle>Donor collection can continue</AlertTitle>
            <AlertDescription>
              {defaultTestNeedsManualHelp
                ? 'The donor is verified. Set or confirm the lab default manually in ToxAccess before continuing collection.'
                : 'The donor and required lab default are ready. Any remaining headshot work will continue in the background.'}
            </AlertDescription>
          </Alert>
        )}

        {needsManualHelp && (
          <Alert variant="warning">
            <CircleAlert />
            <AlertTitle>Manual fallback available</AlertTitle>
            <AlertDescription>
              {status?.lastError || 'Open ToxAccess and create or update the donor manually. Then retry verification here.'}
            </AlertDescription>
          </Alert>
        )}

        {!status && !isLoading && (
          <Alert variant="warning">
            <CircleAlert />
            <AlertTitle>Status unavailable</AlertTitle>
            <AlertDescription>Refresh or open ToxAccess to complete donor setup manually.</AlertDescription>
          </Alert>
        )}
      </CardContent>
      {(needsManualHelp || (!status && !isLoading)) && (
        <CardFooter className="flex flex-wrap justify-end gap-3">
          {status?.manualHref && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(status.manualHref, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink data-icon="inline-start" />
              Open ToxAccess
            </Button>
          )}
          <Button type="button" onClick={onRetry} disabled={isRetrying || status?.overallStatus === 'disabled'}>
            {isRetrying ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCcw data-icon="inline-start" />
            )}
            Retry and verify
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
