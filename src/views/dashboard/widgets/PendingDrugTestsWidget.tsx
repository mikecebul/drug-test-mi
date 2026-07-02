import Link from 'next/link'
import type { WidgetServerProps, Where } from 'payload'
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
  let awaitingScreeningCount: number | null = null
  let awaitingDecisionCount: number | null = null
  let awaitingPaymentCount: number | null = null
  let confirmationPendingCount: number | null = null

  try {
    const countPendingTests = (where: Where) =>
      req.payload.count({
        collection: 'drug-tests',
        where,
        req,
        overrideAccess: false,
      })

    const [pendingTests, awaitingScreening, awaitingDecision, awaitingPayment, confirmationPending] = await Promise.all(
      [
        countPendingTests({
          or: [
            {
              isComplete: {
                equals: false,
              },
            },
            {
              'payment.balanceDue': {
                greater_than: 0,
              },
            },
          ],
        }),
        countPendingTests({
          screeningStatus: {
            equals: 'collected',
          },
          isComplete: {
            equals: false,
          },
        }),
        countPendingTests({
          and: [
            {
              isComplete: {
                equals: false,
              },
            },
            {
              initialScreenResult: {
                in: ['unexpected-positive', 'unexpected-negative-critical', 'mixed-unexpected'],
              },
            },
            {
              or: [
                {
                  confirmationDecision: {
                    equals: 'pending-decision',
                  },
                },
                {
                  confirmationDecision: {
                    exists: false,
                  },
                },
                {
                  confirmationDecision: {
                    equals: null,
                  },
                },
              ],
            },
          ],
        }),
        countPendingTests({
          'payment.balanceDue': {
            greater_than: 0,
          },
        }),
        countPendingTests({
          screeningStatus: {
            equals: 'confirmation-pending',
          },
          isComplete: {
            equals: false,
          },
        }),
      ],
    )

    pendingCount = pendingTests.totalDocs
    awaitingScreeningCount = awaitingScreening.totalDocs
    awaitingDecisionCount = awaitingDecision.totalDocs
    awaitingPaymentCount = awaitingPayment.totalDocs
    confirmationPendingCount = confirmationPending.totalDocs
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Failed to load pending drug test count widget' })
  }

  const pendingBreakdown = [
    {
      label: 'Awaiting screening',
      value: awaitingScreeningCount,
    },
    {
      label: 'Awaiting decision',
      value: awaitingDecisionCount,
    },
    {
      label: 'Awaiting payment',
      value: awaitingPaymentCount,
    },
    {
      label: 'Pending confirmation',
      value: confirmationPendingCount,
    },
  ]

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin" className="h-full">
        <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="size-4" />
              Pending Tests
            </CardTitle>
            <CardDescription>Tests and balances grouped by next action.</CardDescription>
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
            <div className="mt-3 grid gap-2">
              {pendingBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {item.value ?? '-'}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Open the tracker to screen, decide, confirm, or close results.
            </p>
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
