import Link from 'next/link'
import type { WidgetServerProps } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utilities/cn'
import { DASHBOARD_WIDGET_CARD_CLASS } from './widget-card-styles'

export default async function TotalClientsWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  let totalClients: number | null = null

  try {
    const clientCount = await req.payload.count({
      collection: 'clients',
      req,
      overrideAccess: false,
    })

    totalClients = clientCount.totalDocs
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Failed to load total clients widget' })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card className={DASHBOARD_WIDGET_CARD_CLASS}>
        <CardHeader className="space-y-2 pb-3">
          <CardDescription>Total Clients</CardDescription>
          <CardTitle className="text-4xl">{totalClients ?? '-'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
          <CardDescription>
            {totalClients === null ? 'Count unavailable' : 'Registered client records'}
          </CardDescription>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/drug-test-upload?workflow=register-client&step=personalInfo&returnTo=dashboard"
              className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
            >
              Register New Client
            </Link>
            <Link
              href="/admin/collections/clients"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'shrink-0')}
            >
              View Clients
            </Link>
          </div>
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
