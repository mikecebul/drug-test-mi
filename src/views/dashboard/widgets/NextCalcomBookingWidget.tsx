import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_TIMEZONE } from '@/lib/date-utils'
import type { Booking } from '@/payload-types'
import { cn } from '@/utilities/cn'

const ACTIVE_STATUSES = ['confirmed', 'pending', 'rescheduled'] as const
const CALCOM_UPCOMING_BOOKINGS_URL = 'https://app.cal.com/bookings/upcoming'

function getClientName(booking: Booking): string {
  const relatedClient = booking.relatedClient
  if (relatedClient && typeof relatedClient === 'object') {
    const firstName = relatedClient.firstName?.trim()
    const lastName = relatedClient.lastName?.trim()
    if (firstName && lastName) return `${firstName} ${lastName}`
    if (relatedClient.fullName?.trim()) return relatedClient.fullName.trim()
  }

  return booking.attendeeName || 'Unknown client'
}

function formatBookingDateTime(dateString: string): string {
  const tzDate = TZDate.tz(APP_TIMEZONE, new Date(dateString))
  return format(tzDate, 'EEE, MMM d • h:mm a')
}

function isSameAppDate(dateA: Date, dateB: Date): boolean {
  const a = TZDate.tz(APP_TIMEZONE, dateA)
  const b = TZDate.tz(APP_TIMEZONE, dateB)

  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default async function NextCalcomBookingWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  let nextBooking: Booking | null = null
  let todayBookingCount = 0
  let hasLoadError = false

  const now = new Date()
  const appNow = TZDate.tz(APP_TIMEZONE, now)
  const startOfToday = TZDate.tz(APP_TIMEZONE, appNow.getFullYear(), appNow.getMonth(), appNow.getDate(), 0, 0, 0, 0)
  const startOfTomorrow = TZDate.tz(
    APP_TIMEZONE,
    appNow.getFullYear(),
    appNow.getMonth(),
    appNow.getDate() + 1,
    0,
    0,
    0,
    0,
  )

  try {
    const [nextBookingResult, todayBookingCountResult] = await Promise.all([
      req.payload.find({
        collection: 'bookings',
        where: {
          and: [
            {
              status: {
                in: [...ACTIVE_STATUSES],
              },
            },
            {
              startTime: {
                greater_than: now.toISOString(),
              },
            },
          ],
        },
        sort: 'startTime',
        limit: 1,
        depth: 1,
        req,
        overrideAccess: false,
      }),
      req.payload.count({
        collection: 'bookings',
        where: {
          and: [
            {
              status: {
                in: [...ACTIVE_STATUSES],
              },
            },
            {
              startTime: {
                greater_than_equal: startOfToday.toISOString(),
              },
            },
            {
              startTime: {
                less_than: startOfTomorrow.toISOString(),
              },
            },
          ],
        },
        req,
        overrideAccess: false,
      }),
    ])

    nextBooking = (nextBookingResult.docs[0] as Booking | undefined) || null
    todayBookingCount = todayBookingCountResult.totalDocs
  } catch (error) {
    hasLoadError = true
    req.payload.logger.error({ err: error, msg: 'Failed to load next booking dashboard widget' })
  }

  const nextBookingIsToday = nextBooking ? isSameAppDate(new Date(nextBooking.startTime), now) : false

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin">
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasLoadError && <p className="text-muted-foreground text-sm">Unable to load booking data right now.</p>}

          {!hasLoadError && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="border-border bg-background/40 rounded-md border px-3 py-2">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Today</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{todayBookingCount}</p>
                </div>
                <div className="border-border bg-background/40 rounded-md border px-3 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Next</p>
                    <Badge variant={nextBookingIsToday ? 'default' : 'outline'}>
                      {nextBooking ? (nextBookingIsToday ? 'Today' : 'Upcoming') : 'None'}
                    </Badge>
                  </div>
                  {nextBooking ? (
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-semibold">{getClientName(nextBooking)}</p>
                      <p className="text-muted-foreground text-xs">{formatBookingDateTime(nextBooking.startTime)}</p>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold">No upcoming bookings</p>
                  )}
                </div>
              </div>

              <Link
                href={CALCOM_UPCOMING_BOOKINGS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'secondary' }), 'w-full justify-center')}
              >
                View Full Schedule
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
