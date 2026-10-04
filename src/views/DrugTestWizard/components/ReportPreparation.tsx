'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDeviceType } from '@/hooks/use-device-type'
import { REDWOOD_MOBILE_DONORS_URL, resolveGuidedToxAccessHref } from '@/lib/redwood/donor-urls'
import { guidedWorkflowApi } from '../workflows/complete-workflow/guided-workflow-api'
import { redwoodProvisioningNeedsManualHelp } from '../workflows/complete-workflow/RedwoodProvisioningCard'

export function ReportPreparation({ clientId }: { clientId: string }) {
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
    <Card>
      <CardHeader>
        <CardTitle>1. Generate the report in ToxAccess</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        <p className="text-muted-foreground text-sm">
          Open ToxAccess, generate and save the PDF, then close that tab and return here.
        </p>
        {needsHelp && (
          <Alert variant="warning">
            <AlertDescription>
              ToxAccess setup could not be verified. Search for the donor and verify the test manually. Contact Mike at{' '}
              <a className="underline" href="tel:+12313736341">
                (231) 373-6341
              </a>{' '}
              if you need help.
            </AlertDescription>
          </Alert>
        )}
        <Button
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
      </CardContent>
    </Card>
  )
}
