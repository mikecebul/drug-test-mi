import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import {
  CalendarClock,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Clock,
  ExternalLink,
  Menu,
  PlayCircle,
} from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  const isCompleted = booking.sampleCollection?.status === 'collected'
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
        'border-border bg-card grid w-full gap-4 rounded-lg border p-5 text-left transition',
        'md:grid-cols-[minmax(0,1fr)_auto]',
        isCompleted && 'border-border/60 bg-muted/40 text-muted-foreground',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className={cn('size-12 shrink-0', isCompleted && 'opacity-60 grayscale')}>
          <AvatarImage src={booking.client?.headshot || undefined} alt={booking.attendeeName} />
          <AvatarFallback>
            {booking.attendeeName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0))
              .join('')}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'block truncate text-base font-semibold',
                isCompleted && 'line-through decoration-current/60 decoration-1',
              )}
            >
              {booking.attendeeName}
            </span>
            <Badge
              variant="outline"
              className={cn('shrink-0', getGuidedGenderBadgeClass(booking.client?.gender), isCompleted && 'opacity-70')}
            >
              {formatGuidedGender(booking.client?.gender)}
            </Badge>
          </span>
          <span
            className={cn(
              'text-muted-foreground inline-flex items-center gap-1 text-sm',
              isCompleted && 'line-through decoration-current/60 decoration-1',
            )}
          >
            <Clock className="size-3.5" />
            {formatTime(booking.startTime)}
          </span>
          {!isCompleted && (
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
          )}
        </div>
      </div>
      {isCompleted ? (
        <Badge variant="secondary" className="self-start md:self-center">
          <CheckCircle2 data-icon="inline-start" />
          Completed
        </Badge>
      ) : (
        <div className="flex flex-wrap items-center gap-2 md:justify-end md:self-center">
          <Link href={getGuidedScheduleHref(booking)} className={cn(buttonVariants({ size: 'sm' }), 'min-w-32 gap-2')}>
            <PlayCircle data-icon="inline-start" />
            {workflowLabel}
          </Link>
          {rescheduleHref && (
            <a
              href={rescheduleHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-2')}
            >
              <CalendarClock data-icon="inline-start" />
              Reschedule
              <ExternalLink data-icon="inline-end" />
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
              <CalendarX data-icon="inline-start" />
              Cancel
              <ExternalLink data-icon="inline-end" />
            </a>
          )}
        </div>
      )}
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
    bookings = await getTodaysCollectionBookings(req)
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
