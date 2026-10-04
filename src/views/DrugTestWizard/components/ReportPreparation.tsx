'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDeviceType } from '@/hooks/use-device-type'
import { REDWOOD_MOBILE_DONORS_URL, resolveGuidedToxAccessHref } from '@/lib/redwood/donor-urls'
import { guidedWorkflowApi } from '../workflows/complete-workflow/guided-workflow-api'
import { redwoodProvisioningNeedsManualHelp } from '../workflows/complete-workflow/RedwoodProvisioningCard'
import { OptionalDetails } from './OptionalDetails'

export function ReportPreparation({
  clientId,
  hasReport,
  children,
}: {
  clientId: string
  hasReport: boolean
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const device = useDeviceType()
  const started = useRef<string | null>(null)
  const queryKey = ['guided', 'redwood-provisioning', clientId, '17-panel-instant']
  const {
    data: status,
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: ({ signal }) => guidedWorkflowApi.getRedwoodStatus(clientId, '17-panel-instant', signal),
    enabled: Boolean(clientId),
    retry: false,
    staleTime: 1_000,
    refetchInterval: (query) =>
      query.state.status !== 'error' && (!query.state.data || query.state.data.overallStatus === 'working')
        ? 1_000
        : false,
  })
  useEffect(() => {
    if (!clientId || started.current === clientId) return
    started.current = clientId
    void guidedWorkflowApi
      .ensureRedwood({ clientId, testTypeValue: '17-panel-instant' })
      .then(() => queryClient.invalidateQueries({ queryKey: ['guided', 'redwood-provisioning', clientId] }))
      .catch(() => queryClient.invalidateQueries({ queryKey: ['guided', 'redwood-provisioning', clientId] }))
  }, [clientId, queryClient])
  const needsHelp = isError || redwoodProvisioningNeedsManualHelp(status)
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
            <h3 className="text-lg font-semibold">1. Generate in ToxAccess</h3>
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
            <ol className="text-muted-foreground flex flex-col gap-3 text-sm">
              {['Complete the instant test', 'Generate and save the PDF', 'Close that tab and return here'].map(
                (instruction, index) => (
                  <li key={instruction} className="flex items-start gap-3">
                    <span className="bg-muted text-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{instruction}</span>
                  </li>
                ),
              )}
            </ol>
          </section>
          <section className="border-border flex min-w-0 flex-col gap-4 border-t p-4 min-[600px]:border-t-0 min-[600px]:border-l sm:p-6">
            <h3 className="text-lg font-semibold">2. Upload the saved PDF</h3>
            {children}
          </section>
        </div>
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 sm:px-6">
          <span className="text-sm font-medium">Report status</span>
          <Badge variant={hasReport ? 'success' : 'warning'}>
            {hasReport && <CheckCircle2 data-icon="inline-start" />}
            {hasReport ? 'PDF uploaded' : 'Waiting for PDF'}
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
