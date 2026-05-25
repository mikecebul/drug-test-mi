import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { CalendarDays, Clock } from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
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
  return (
    <Link
      href={getGuidedScheduleHref(booking)}
      className={cn(
        'border-border bg-card hover:bg-muted/50 focus-visible:ring-ring grid w-full grid-cols-[1fr_auto] gap-3',
        'rounded-lg border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      <span className="min-w-0 space-y-1">
        <span className="block truncate text-base font-semibold">{booking.attendeeName}</span>
        <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatTime(booking.startTime)}
          </span>
          <span>{formatGender(booking.client?.gender)}</span>
        </span>
      </span>
      <span className="flex flex-col items-end gap-2">
        <Badge
          variant={paymentLabel === 'Unpaid' || paymentLabel === 'Still owes' ? 'outline' : 'default'}
          className={cn(
            paymentLabel === 'Still owes' && 'border-destructive text-destructive',
            paymentLabel === 'Collected' && 'bg-primary text-primary-foreground',
          )}
        >
          {paymentLabel}
        </Badge>
        {needsRegistration && <Badge variant="secondary">Register</Badge>}
        {needsTestType && <Badge variant="secondary">Set test</Badge>}
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
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3">
            <CalendarDays className="size-5" />
            Today&apos;s Schedule
          </CardTitle>
          <CardDescription>Name, time, payment status, and registration status.</CardDescription>
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
