import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { CalendarDays, CheckCircle2, Clock, Menu } from 'lucide-react'

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
import { ScheduleRowActions } from './ScheduleRowActions'

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
        'border-border bg-card grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border p-3 text-left transition',
        isCompleted
          ? 'border-border/60 bg-muted/40 text-muted-foreground'
          : 'hover:bg-muted/50 focus-within:border-primary/40',
      )}
    >
      {isCompleted ? (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10 shrink-0 opacity-60 grayscale">
            <AvatarImage src={booking.client?.headshot || undefined} alt={booking.attendeeName} />
            <AvatarFallback>
              {booking.attendeeName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join('')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="line-clamp-2 font-semibold line-through decoration-current/60 decoration-1">
                {booking.attendeeName}
              </span>
              <Badge
                variant="outline"
                className={cn('shrink-0 opacity-70', getGuidedGenderBadgeClass(booking.client?.gender))}
              >
                {formatGuidedGender(booking.client?.gender)}
              </Badge>
            </span>
            <span className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-sm line-through decoration-current/60 decoration-1">
              <Clock className="size-4" />
              {formatTime(booking.startTime)}
            </span>
          </div>
        </div>
      ) : (
        <Link
          href={getGuidedScheduleHref(booking)}
          aria-label={`${workflowLabel} for ${booking.attendeeName}`}
          className="focus-visible:ring-ring hover:text-foreground flex min-w-0 items-center gap-3 rounded-md transition focus-visible:ring-2 focus-visible:outline-none"
        >
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={booking.client?.headshot || undefined} alt={booking.attendeeName} />
            <AvatarFallback>
              {booking.attendeeName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join('')}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="line-clamp-2 font-semibold">{booking.attendeeName}</span>
              <Badge variant="outline" className={cn('shrink-0', getGuidedGenderBadgeClass(booking.client?.gender))}>
                {formatGuidedGender(booking.client?.gender)}
              </Badge>
            </span>
            <span className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-sm">
              <Clock className="size-4" />
              {formatTime(booking.startTime)}
            </span>
          </span>
        </Link>
      )}

      <div className="flex items-start gap-2">
        <div className="flex flex-col items-end gap-2">
          <Badge
            variant={
              isCompleted
                ? 'secondary'
                : paymentLabel === 'Paid' || paymentLabel === 'Pre-paid' || paymentLabel === 'Collected'
                  ? 'success'
                  : paymentLabel === 'Unpaid' || paymentLabel === 'Still owes'
                    ? 'outline'
                    : 'default'
            }
            className={cn(paymentLabel === 'Still owes' && 'border-destructive text-destructive')}
          >
            {isCompleted && <CheckCircle2 data-icon="inline-start" />}
            {isCompleted ? 'Completed' : paymentLabel}
          </Badge>
          {!isCompleted && needsRegistration && <Badge variant="secondary">Register</Badge>}
          {!isCompleted && needsTestType && <Badge variant="secondary">Set test</Badge>}
        </div>

        {!isCompleted && (
          <ScheduleRowActions
            attendeeName={booking.attendeeName}
            cancelHref={cancelHref}
            rescheduleHref={rescheduleHref}
          />
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
    bookings = await getTodaysCollectionBookings(req)
  } catch (error) {
    hasLoadError = true
    req.payload.logger.error({ err: error, msg: 'Failed to load schedule dashboard widget' })
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin">
        <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-3 sm:gap-4">
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
        <CardContent className="flex flex-col gap-2 p-4 pt-0">
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
