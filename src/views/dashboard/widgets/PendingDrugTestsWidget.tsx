import Link from 'next/link'
import type { WidgetServerProps } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utilities/cn'

export default async function PendingDrugTestsWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  let pendingCount: number | null = null

  try {
    const pendingTests = await req.payload.count({
      collection: 'drug-tests',
      where: {
        isComplete: {
          equals: false,
        },
      },
      req,
      overrideAccess: false,
    })

    pendingCount = pendingTests.totalDocs
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Failed to load pending drug test count widget' })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin">
        <CardHeader className="space-y-2">
          <CardDescription>Pending Drug Tests</CardDescription>
          <CardTitle className="text-4xl">{pendingCount ?? '-'}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <CardDescription>
            {pendingCount === null ? 'Count unavailable' : 'Incomplete tests requiring follow-up'}
          </CardDescription>
          <Link
            href="/admin/drug-test-tracker"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'shrink-0')}
          >
            Open Tracker
          </Link>
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
