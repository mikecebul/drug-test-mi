'use client'

import { ExternalLink, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDeviceType } from '@/hooks/use-device-type'
import { REDWOOD_MOBILE_DONORS_URL, resolveGuidedToxAccessHref } from '@/lib/redwood/donor-urls'
import type { GuidedRedwoodProvisioningStatus } from '../workflows/complete-workflow/actions'
import { redwoodProvisioningNeedsManualHelp } from '../workflows/complete-workflow/RedwoodProvisioningCard'
import { OptionalDetails } from './OptionalDetails'

export function LabPreparation({
  status,
  isLoading,
  testCode,
  donorName,
}: {
  status?: GuidedRedwoodProvisioningStatus
  isLoading: boolean
  testCode: string
  donorName: string
}) {
  const device = useDeviceType()
  const needsHelp = redwoodProvisioningNeedsManualHelp(status) || (!status && !isLoading)
  const ready = Boolean(status?.canContinue && !needsHelp)
  const href = resolveGuidedToxAccessHref({
    donorId: status?.donorId,
    mobileHref: status?.collectSpecimenHref || status?.manualHref || REDWOOD_MOBILE_DONORS_URL,
    useDesktopSite: device === 'desktop',
  })
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>ToxAccess</CardTitle>
          <Badge variant={needsHelp ? 'warning' : ready ? 'success' : 'secondary'}>
            {!ready && !needsHelp && <Loader2 className="size-3 animate-spin" />}
            {needsHelp ? 'Needs help' : ready ? 'Donor ready' : 'Checking donor'}
          </Badge>
        </div>
        <Button
          variant="outline"
          render={<a href={href} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
        >
          Open ToxAccess <ExternalLink data-icon="inline-end" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-2 text-sm sm:grid-cols-[130px_1fr]">
          <span className="text-muted-foreground">Donor name</span>
          <strong>{donorName}</strong>
          <span className="text-muted-foreground">Test code</span>
          <strong>{testCode}</strong>
        </div>
        <ol className="space-y-4 border-y py-5">
          {['Collect the specimen in ToxAccess', 'Return here to record collection details'].map((text, index) => (
            <li key={text} className="flex items-center gap-3">
              <span className="bg-info-muted text-info-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-semibold">
                {index + 1}
              </span>
              {text}
            </li>
          ))}
        </ol>
        <OptionalDetails title="ToxAccess setup needs help" invalid={needsHelp}>
          <Alert variant={needsHelp ? 'warning' : 'info'}>
            <AlertDescription>
              {needsHelp
                ? 'Search for the donor and verify the test manually before collection.'
                : 'If the donor or test is missing, verify it manually before collection.'}
              <p>
                Contact Mike at{' '}
                <a href="tel:+12313736341" className="underline">
                  (231) 373-6341
                </a>{' '}
                if you need help.
              </p>
            </AlertDescription>
          </Alert>
        </OptionalDetails>
      </CardContent>
    </Card>
  )
}
