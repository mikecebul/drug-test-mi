import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { CalendarClock, CalendarDays, CalendarX, Clock, ExternalLink, Menu, PlayCircle } from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { cn } from '@/utilities/cn'
import { getTodaysCollectionBookings } from '@/views/DrugTestWizard/workflows/complete-workflow/actions'
import {
  formatGuidedGender,
  getGuidedGenderBadgeClass,
  getGuidedPaymentLabel,
  getGuidedScheduleHref,
} from '@/views/DrugTestWizard/workflows/complete-workflow/schedule-utils'

type Booking = Awaited<ReturnType<typeof getTodaysCollectionBookings>>[number]

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  }).format(new Date(value))
}

function ScheduleRow({ booking }: { booking: Booking }) {
  const paymentLabel = getGuidedPaymentLabel(booking)
  const needsRegistration = booking.needsRegistration
  const needsTestType = booking.needsTestType
  const workflowLabel = needsRegistration || needsTestType ? 'Review & Start' : 'Collect Test'
  const { cancelHref, rescheduleHref } = booking.calcomActionLinks ?? {
    cancelHref: null,
    rescheduleHref: null,
  }

  return (
    <div
      className={cn(
        'border-border/70 bg-card grid w-full gap-4 rounded-md border p-4 text-left transition',
        'md:grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center">
        <span className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
          <Clock className="text-muted-foreground size-3.5" />
          {formatTime(booking.startTime)}
        </span>
        <span className="min-w-0 space-y-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="block truncate text-base font-semibold">{booking.attendeeName}</span>
            <Badge variant="outline" className={cn('shrink-0', getGuidedGenderBadgeClass(booking.client?.gender))}>
              {formatGuidedGender(booking.client?.gender)}
            </Badge>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                paymentLabel === 'Paid' || paymentLabel === 'Pre-paid' || paymentLabel === 'Collected'
                  ? 'success'
                  : paymentLabel === 'Unpaid' || paymentLabel === 'Still owes'
                    ? 'outline'
                    : 'default'
              }
              className={cn(paymentLabel === 'Still owes' && 'border-destructive text-destructive')}
            >
              {paymentLabel}
            </Badge>
            {needsRegistration && <Badge variant="secondary">Register</Badge>}
            {needsTestType && <Badge variant="secondary">Set test</Badge>}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end md:self-center">
        <Link href={getGuidedScheduleHref(booking)} className={cn(buttonVariants({ size: 'sm' }), 'min-w-32 gap-2')}>
          <PlayCircle className="size-4" />
          {workflowLabel}
        </Link>
        {rescheduleHref && (
          <a
            href={rescheduleHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-2')}
          >
            <CalendarClock className="size-4" />
            Reschedule
            <ExternalLink className="size-3" />
          </a>
        )}
        {cancelHref && (
          <a
            href={cancelHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: 'sm', variant: 'outline' }),
              'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2',
            )}
          >
            <CalendarX className="size-4" />
            Cancel
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}

export default async function NextCalcomBookingWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  let bookings: Booking[] = []
  let hasLoadError = false

  try {
    bookings = await getTodaysCollectionBookings()
  } catch (error) {
    hasLoadError = true
    req.payload.logger.error({ err: error, msg: 'Failed to load schedule dashboard widget' })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin">
        <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-3 text-xl">
              <CalendarDays className="size-5" />
              Today&apos;s Schedule
            </CardTitle>
            <CardDescription>
              {bookings.length === 1 ? '1 test scheduled today.' : `${bookings.length} tests scheduled today.`}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/drug-test-upload"
              className={cn(
                buttonVariants({ size: 'sm', variant: bookings.length > 0 ? 'secondary' : 'default' }),
                'gap-2',
              )}
            >
              <Menu className="size-4" />
              Menu
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasLoadError && <p className="text-muted-foreground text-sm">Unable to load booking data right now.</p>}

          {!hasLoadError && bookings.length === 0 && (
            <p className="text-muted-foreground text-sm">No Cal.com appointments scheduled for today.</p>
          )}

          {!hasLoadError && bookings.map((booking) => <ScheduleRow key={booking.id} booking={booking} />)}
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
