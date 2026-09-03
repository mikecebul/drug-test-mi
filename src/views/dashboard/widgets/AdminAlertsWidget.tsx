import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { AlertTriangle, Bell, CalendarClock } from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utilities/cn'
import { getTodaysCollectionBookings } from '@/views/DrugTestWizard/workflows/complete-workflow/actions'

type AlertItem = {
  href: string
  label: string
  tone: 'attention' | 'warning'
  value: string
}

export default async function AdminAlertsWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  const alerts: AlertItem[] = []

  try {
    const bookings = await getTodaysCollectionBookings(req)
    const missingTestTypeCount = bookings.filter((booking) => booking.needsTestType).length
    const pendingPaymentCount = bookings.filter((booking) => booking.paymentRecoveryStatus === 'pending').length
    const partialPaymentCount = bookings.filter((booking) => booking.paymentRecoveryStatus === 'partial').length

    if (partialPaymentCount > 0) {
      alerts.push({
        href: '/admin/drug-test-upload?workflow=guided&step=schedule',
        label: 'Partial payments need review',
        tone: 'warning',
        value: `${partialPaymentCount}`,
      })
    }

    if (pendingPaymentCount > 0) {
      alerts.push({
        href: '/admin/drug-test-upload?workflow=guided&step=schedule',
        label: 'Pending payments need a decision',
        tone: 'warning',
        value: `${pendingPaymentCount}`,
      })
    }

    if (missingTestTypeCount > 0) {
      alerts.push({
        href: '/admin/drug-test-upload?workflow=guided&step=schedule',
        label: 'Bookings need test type review',
        tone: 'attention',
        value: `${missingTestTypeCount}`,
      })
    }
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Failed to load schedule alerts' })
    alerts.push({
      href: '/admin/drug-test-upload?workflow=guided&step=schedule',
      label: 'Schedule sync needs review',
      tone: 'warning',
      value: '!',
    })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin" className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Bell className="size-4" />
              Admin Alerts
            </CardTitle>
            <CardDescription>Items that may slow down today&apos;s workflow.</CardDescription>
          </div>
          <Badge variant={alerts.length > 0 ? 'outline' : 'secondary'}>{alerts.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 && (
            <div className="border-border/70 bg-muted/30 flex items-center gap-3 rounded-md border px-3 py-3">
              <CalendarClock className="text-muted-foreground size-4" />
              <p className="text-muted-foreground text-sm">No admin alerts right now.</p>
            </div>
          )}

          {alerts.map((alert) => (
            <Link
              href={alert.href}
              key={`${alert.label}-${alert.value}`}
              className="border-border/70 hover:bg-muted/60 flex items-center justify-between gap-4 rounded-md border px-3 py-3 transition"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md',
                    alert.tone === 'warning'
                      ? 'bg-warning-muted text-warning-foreground'
                      : 'bg-info-muted text-info-foreground',
                  )}
                >
                  <AlertTriangle className="size-4" />
                </span>
                <span className="text-sm font-medium">{alert.label}</span>
              </span>
              <Badge variant="outline" className="shrink-0">
                {alert.value}
              </Badge>
            </Link>
          ))}

          <Link
            href="/admin/drug-test-tracker"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'w-full justify-center')}
          >
            Open Tracker
          </Link>
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
