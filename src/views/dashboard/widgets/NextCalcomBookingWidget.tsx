import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { CalendarDays, Clock, PlayCircle } from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utilities/cn'
import { getTodaysCollectionBookings } from '@/views/DrugTestWizard/workflows/complete-workflow/actions'
import {
  getGuidedPaymentLabel,
  getGuidedScheduleHref,
} from '@/views/DrugTestWizard/workflows/complete-workflow/schedule-utils'

type Booking = Awaited<ReturnType<typeof getTodaysCollectionBookings>>[number]

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatGender(value?: string | null) {
  if (value === 'male') return 'Male'
  if (value === 'female') return 'Female'
  if (value === 'other') return 'Other'
  return 'Unknown'
}

function ScheduleRow({ booking }: { booking: Booking }) {
  const paymentLabel = getGuidedPaymentLabel(booking)
  const needsRegistration = booking.needsRegistration
  const needsTestType = booking.needsTestType
  const workflowLabel = needsRegistration || needsTestType ? 'Review & Start' : 'Start Guided Workflow'
  return (
    <Link
      href={getGuidedScheduleHref(booking)}
      className={cn(
        'border-border/70 bg-card hover:bg-muted/50 focus-visible:ring-ring grid w-full gap-4',
        'rounded-md border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none',
        'md:grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      <span className="grid min-w-0 gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center">
        <span className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
          <Clock className="text-muted-foreground size-3.5" />
          {formatTime(booking.startTime)}
        </span>
        <span className="min-w-0 space-y-2">
          <span className="block truncate text-base font-semibold">{booking.attendeeName}</span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge
              variant={paymentLabel === 'Unpaid' || paymentLabel === 'Still owes' ? 'outline' : 'default'}
              className={cn(
                paymentLabel === 'Still owes' && 'border-destructive text-destructive',
                paymentLabel === 'Collected' && 'bg-primary text-primary-foreground',
              )}
            >
              {paymentLabel}
            </Badge>
            <Badge variant="secondary">{formatGender(booking.client?.gender)}</Badge>
            {needsRegistration && <Badge variant="secondary">Register</Badge>}
            {needsTestType && <Badge variant="secondary">Set test</Badge>}
          </span>
        </span>
      </span>
      <span className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium md:self-center">
        <PlayCircle className="size-4" />
        {workflowLabel}
      </span>
    </Link>
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
              <PlayCircle className="size-4" />
              Collect Test
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
