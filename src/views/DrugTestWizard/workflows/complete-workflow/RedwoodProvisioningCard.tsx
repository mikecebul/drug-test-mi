'use client'

import { CheckCircle2, CircleAlert, ExternalLink, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useDeviceType } from '@/hooks/use-device-type'
import { resolveGuidedToxAccessHref } from '@/lib/redwood/donor-urls'
import { cn } from '@/utilities/cn'
import type { GuidedRedwoodProvisioningStatus } from './actions'

type Props = {
  isLoading: boolean
  status?: GuidedRedwoodProvisioningStatus
}

export function redwoodProvisioningNeedsManualHelp(status?: GuidedRedwoodProvisioningStatus) {
  return Boolean(
    status &&
    (status.overallStatus === 'disabled' ||
      status.overallStatus === 'failed' ||
      status.overallStatus === 'manual-review' ||
      status.steps.some(
        (step) => step.id === 'default-test' && (step.status === 'failed' || step.status === 'manual-review'),
      )),
  )
}

function redwoodDonorNeedsManualSearch(status?: GuidedRedwoodProvisioningStatus) {
  return Boolean(
    status &&
    (status.overallStatus === 'disabled' ||
      status.overallStatus === 'failed' ||
      status.overallStatus === 'manual-review'),
  )
}

function redwoodDefaultTestNeedsHelp(status?: GuidedRedwoodProvisioningStatus) {
  return Boolean(
    status?.steps.some(
      (step) => step.id === 'default-test' && (step.status === 'failed' || step.status === 'manual-review'),
    ),
  )
}

function getCardCopy(status?: GuidedRedwoodProvisioningStatus) {
  if (!status) {
    return {
      title: 'Checking ToxAccess donor',
      description: 'Confirming the donor is ready for collection.',
    }
  }

  if (redwoodProvisioningNeedsManualHelp(status)) {
    return {
      title: 'ToxAccess setup needs help',
      description: null,
    }
  }

  if (status.canContinue) {
    return {
      title: 'Donor ready',
      description: status.donorId
        ? `Donor ${status.donorId} is ready for collection in ToxAccess.`
        : 'The donor is ready for collection in ToxAccess.',
    }
  }

  return {
    title: 'Setting up ToxAccess donor',
    description: 'This is happening automatically. You can continue when the donor is ready.',
  }
}

export function RedwoodProvisioningCard({ isLoading, status }: Props) {
  const deviceType = useDeviceType()
  const useDesktopSite = deviceType !== 'desktop'
  const donorNeedsManualSearch = redwoodDonorNeedsManualSearch(status) || (!status && !isLoading)
  const defaultTestNeedsHelp = redwoodDefaultTestNeedsHelp(status)
  const needsManualHelp = donorNeedsManualSearch || defaultTestNeedsHelp
  const isReady = Boolean(status?.canContinue && !needsManualHelp)
  const isWorking = !isReady && !needsManualHelp
  const copy = getCardCopy(donorNeedsManualSearch && !status ? undefined : status)
  const TitleIcon = isReady ? CheckCircle2 : needsManualHelp ? CircleAlert : Loader2
  const statusLabel = needsManualHelp ? 'Needs help' : isReady ? 'Ready for collection' : 'Working'
  const statusVariant = needsManualHelp ? 'warning' : isReady ? 'success' : 'secondary'
  const collectSpecimenHref = status?.collectSpecimenHref
    ? resolveGuidedToxAccessHref({
        donorId: status.donorId,
        mobileHref: status.collectSpecimenHref,
        useDesktopSite,
      })
    : null
  const manualHref = status?.manualHref
    ? resolveGuidedToxAccessHref({
        mobileHref: status.manualHref,
        useDesktopSite,
      })
    : null

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-lg',
        isReady && 'border-success/40 bg-success/5',
        needsManualHelp && 'border-amber-300 bg-amber-50/40',
      )}
    >
      <CardHeader className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'bg-muted flex size-9 shrink-0 items-center justify-center rounded-full border',
              isReady && 'border-success/30 bg-success/10',
              needsManualHelp && 'border-amber-300 bg-amber-50',
            )}
          >
            <TitleIcon
              className={cn(
                'size-4',
                isReady && 'text-success',
                needsManualHelp && 'text-amber-700',
                isWorking && 'text-primary animate-spin',
              )}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">
                {donorNeedsManualSearch && !status
                  ? 'ToxAccess status unavailable'
                  : defaultTestNeedsHelp
                    ? 'Default test needs help'
                    : copy.title}
              </CardTitle>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
            {donorNeedsManualSearch ? (
              <CardDescription>
                Let Mike know at{' '}
                <a className="text-foreground font-semibold underline underline-offset-4" href="tel:+12313736341">
                  (231) 373-6341
                </a>
                . To complete this collection, open ToxAccess and search for the donor manually.
              </CardDescription>
            ) : defaultTestNeedsHelp ? (
              <CardDescription>
                The donor is available, but the default test was not verified. Let Mike know at{' '}
                <a className="text-foreground font-semibold underline underline-offset-4" href="tel:+12313736341">
                  (231) 373-6341
                </a>
                , then verify the test in ToxAccess before collection.
              </CardDescription>
            ) : (
              <CardDescription>{copy.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>

      {(((isReady || defaultTestNeedsHelp) && collectSpecimenHref) ||
        (donorNeedsManualSearch && manualHref)) && (
        <CardFooter className="justify-end p-4 pt-0">
          {(isReady || defaultTestNeedsHelp) && collectSpecimenHref ? (
            <Button
              render={<a href={collectSpecimenHref} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink data-icon="inline-start" />
              Link to ToxAccess
            </Button>
          ) : (
            manualHref && (
              <Button
                render={<a href={manualHref} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <ExternalLink data-icon="inline-start" />
                Open ToxAccess to search manually
              </Button>
            )
          )}
        </CardFooter>
      )}
    </Card>
  )
}
