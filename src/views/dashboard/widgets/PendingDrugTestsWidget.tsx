import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { ClipboardList } from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
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
      <Card variant="admin" className="h-full">
        <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="size-4" />
              Pending Tests
            </CardTitle>
            <CardDescription>Incomplete tests that need follow-up.</CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 text-sm">
            {pendingCount ?? '-'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-border/70 bg-muted/30 rounded-md border px-3 py-3">
            <p className="text-sm font-medium">
              {pendingCount === null
                ? 'Count unavailable'
                : pendingCount === 1
                  ? '1 test needs follow-up'
                  : `${pendingCount} tests need follow-up`}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Open the tracker to screen, confirm, or close results.</p>
          </div>
          <Link
            href="/admin/drug-test-tracker"
            className={cn(buttonVariants({ variant: 'secondary' }), 'w-full justify-center')}
          >
            Open Tracker
          </Link>
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
