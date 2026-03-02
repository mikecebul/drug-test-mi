import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { CalendarClock, Clock, User } from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_TIMEZONE } from '@/lib/date-utils'
import type { Booking } from '@/payload-types'
import { cn } from '@/utilities/cn'
import { DASHBOARD_WIDGET_CARD_CLASS } from './widget-card-styles'

const ACTIVE_STATUSES = ['confirmed', 'pending', 'rescheduled'] as const

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

function getClientId(booking: Booking): string | null {
  const relatedClient = booking.relatedClient
  if (!relatedClient) return null
  if (typeof relatedClient === 'string') return relatedClient
  return relatedClient.id || null
}

function formatBookingDateTime(dateString: string): string {
  const tzDate = TZDate.tz(APP_TIMEZONE, new Date(dateString))
  return format(tzDate, 'EEEE, MMMM d, yyyy • h:mm a')
}

function formatBookingTime(dateString: string): string {
  const tzDate = TZDate.tz(APP_TIMEZONE, new Date(dateString))
  return format(tzDate, 'h:mm a')
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
  let todayBookings: Booking[] = []
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
    const [nextBookingResult, todayBookingsResult] = await Promise.all([
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
        sort: 'startTime',
        limit: 200,
        depth: 1,
        req,
        overrideAccess: false,
      }),
    ])

    nextBooking = (nextBookingResult.docs[0] as Booking | undefined) || null
    todayBookings = todayBookingsResult.docs as Booking[]
  } catch (error) {
    hasLoadError = true
    req.payload.logger.error({ err: error, msg: 'Failed to load next booking dashboard widget' })
  }

  const nextBookingIsToday = nextBooking ? isSameAppDate(new Date(nextBooking.startTime), now) : false
  const hasAnyTodayBookings = todayBookings.length > 0
  const todayBookingsWithoutHighlighted = nextBooking
    ? todayBookings.filter((booking) => booking.id !== nextBooking?.id)
    : todayBookings
  const showTodayList = todayBookingsWithoutHighlighted.length > 0
  const nextBookingClientId = nextBooking ? getClientId(nextBooking) : null

  return (
    <ShadcnWrapper className="pb-0">
      <Card className={DASHBOARD_WIDGET_CARD_CLASS}>
        <CardHeader className="pb-3">
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasLoadError && <CardDescription>Unable to load booking data right now.</CardDescription>}

          {!hasLoadError && !nextBooking && (
            <div className="rounded-lg border p-4">
              <p className="font-medium">No upcoming bookings</p>
              <CardDescription>There are no confirmed, pending, or rescheduled appointments ahead.</CardDescription>
            </div>
          )}

          {!hasLoadError && nextBooking && (
            <div
              className={cn(
                'rounded-lg border p-4',
                nextBookingIsToday ? 'border-emerald-300 bg-emerald-50/70' : 'border-border',
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <CalendarClock className="text-muted-foreground h-4 w-4" />
                <p className="font-medium">Next Appointment</p>
                {nextBookingIsToday && <Badge variant="default">Today</Badge>}
              </div>
              <p className="text-lg font-semibold">{getClientName(nextBooking)}</p>
              <CardDescription>{formatBookingDateTime(nextBooking.startTime)}</CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/collections/bookings/${nextBooking.id}`} className={cn(buttonVariants({ size: 'sm' }))}>
                  View Booking
                </Link>
                {nextBookingClientId && (
                  <Link href={`/admin/collections/clients/${nextBookingClientId}`} className={cn(buttonVariants({ size: 'sm', variant: 'secondary' }))}>
                    View Client
                  </Link>
                )}
              </div>
            </div>
          )}

          {!hasLoadError && !hasAnyTodayBookings && <CardDescription>No appointments today.</CardDescription>}

          {!hasLoadError && showTodayList && (
            <div className="space-y-2">
              <p className="font-medium">Today&apos;s Schedule</p>
              <div className="space-y-2">
                {todayBookingsWithoutHighlighted.map((booking) => {
                  const clientId = getClientId(booking)

                  return (
                    <div key={booking.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium">{getClientName(booking)}</p>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatBookingTime(booking.startTime)}</span>
                          <Badge variant="outline" className="capitalize">
                            {booking.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {clientId && (
                          <Link
                            href={`/admin/collections/clients/${clientId}`}
                            className={cn(buttonVariants({ size: 'icon', variant: 'secondary' }), 'h-8 w-8')}
                          >
                            <User className="h-4 w-4" />
                            <span className="sr-only">Open client</span>
                          </Link>
                        )}
                        <Link href={`/admin/collections/bookings/${booking.id}`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
                          Open
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
