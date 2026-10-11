'use client'

import type { ReactNode } from 'react'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDeviceType } from '@/hooks/use-device-type'
import { REDWOOD_MOBILE_DONORS_URL, resolveGuidedToxAccessHref } from '@/lib/redwood/donor-urls'
import type { GuidedRedwoodProvisioningStatus } from '../workflows/complete-workflow/actions'
import { redwoodProvisioningNeedsManualHelp } from '../workflows/complete-workflow/RedwoodProvisioningCard'
import { OptionalDetails } from './OptionalDetails'

export function ReportPreparationLayout({
  status,
  isLoading,
  isError = false,
  generationDetails,
  nextTitle,
  reportComplete,
  reportStatus,
  children,
}: {
  status?: GuidedRedwoodProvisioningStatus
  isLoading: boolean
  isError?: boolean
  generationDetails?: ReactNode
  nextTitle: string
  reportComplete: boolean
  reportStatus: string
  children: ReactNode
}) {
  const device = useDeviceType()
  const needsHelp = isError || redwoodProvisioningNeedsManualHelp(status) || (!status && !isLoading)
  const href = resolveGuidedToxAccessHref({
    donorId: status?.donorId,
    mobileHref: status?.collectSpecimenHref || status?.manualHref || REDWOOD_MOBILE_DONORS_URL,
    useDesktopSite: device === 'desktop',
  })

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="p-0">
        <div className="grid min-[600px]:grid-cols-2" data-testid="report-preparation-panes">
          <section className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
            <h3 className="text-lg font-semibold">1. Generate report</h3>
            <div>
              <Badge variant={needsHelp ? 'warning' : status?.overallStatus === 'ready' ? 'success' : 'outline'}>
                {isLoading || status?.overallStatus === 'working'
                  ? 'Checking donor setup'
                  : needsHelp
                    ? 'Verify donor in ToxAccess'
                    : status?.overallStatus === 'ready'
                      ? 'Donor ready'
                      : 'Donor setup unverified'}
              </Badge>
            </div>
            <Button
              className="w-full"
              render={href ? <a href={href} target="_blank" rel="noopener noreferrer" /> : undefined}
              nativeButton={!href}
              disabled={!href}
            >
              {isLoading ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ExternalLink data-icon="inline-start" />
              )}
              Open ToxAccess
            </Button>
            {generationDetails}
          </section>
          <section className="border-border flex min-w-0 flex-col gap-4 border-t p-4 min-[600px]:border-t-0 min-[600px]:border-l sm:p-6">
            <h3 className="text-lg font-semibold">{nextTitle}</h3>
            {children}
          </section>
        </div>
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 sm:px-6">
          <span className="text-sm font-medium">Report status</span>
          <Badge variant={reportComplete ? 'success' : 'warning'}>
            {reportComplete && <CheckCircle2 data-icon="inline-start" />}
            {reportStatus}
          </Badge>
        </div>
        <div className="px-4 pb-4 sm:px-6">
          <OptionalDetails title="ToxAccess setup needs help?">
            {needsHelp && (
              <Alert variant="warning">
                <AlertDescription>ToxAccess setup could not be verified.</AlertDescription>
              </Alert>
            )}
            <p className="text-muted-foreground text-sm">
              Search for the donor and verify the test manually. Contact Mike at{' '}
              <a className="underline" href="tel:+12313736341">
                (231) 373-6341
              </a>{' '}
              if you need help.
            </p>
          </OptionalDetails>
        </div>
      </CardContent>
    </Card>
  )
}
