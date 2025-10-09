import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, SetStepNav } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ScheduleCalendarClient } from './ScheduleCalendarClient'
import { bookingsToEvents, appointmentsToEvents } from './utils'
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import type { Booking, Appointment } from '@/payload-types'

export default async function ScheduleCalendar({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const payload = await getPayload({ config })

  // Fetch data for 3 months (previous, current, next) for better UX
  const now = new Date()
  const rangeStart = startOfMonth(subMonths(now, 1))
  const rangeEnd = endOfMonth(addMonths(now, 1))

  // Fetch all bookings within the range
  const bookingsResult = await payload.find({
    collection: 'bookings',
    where: {
      startTime: {
        greater_than_equal: rangeStart.toISOString(),
        less_than_equal: rangeEnd.toISOString(),
      },
    },
    depth: 1,
    limit: 1000,
    sort: 'startTime',
  })

  // Fetch all active recurring appointments
  const appointmentsResult = await payload.find({
    collection: 'appointments',
    where: {
      isActive: {
        equals: true,
      },
      // Only fetch appointments that could have occurrences in our range
      startDate: {
        less_than_equal: rangeEnd.toISOString(),
      },
    },
    depth: 1,
    limit: 1000,
    sort: 'startDate',
  })

  // Filter out appointments that have ended before our range
  const activeAppointments = (appointmentsResult.docs as Appointment[]).filter((apt) => {
    if (!apt.endDate) return true // No end date means it's ongoing
    return new Date(apt.endDate) >= rangeStart
  })

  // Convert to calendar events
  const bookingEvents = bookingsToEvents(bookingsResult.docs as Booking[])
  const appointmentEvents = appointmentsToEvents(activeAppointments, rangeStart, rangeEnd)

  // Combine all events
  const allEvents = [...bookingEvents, ...appointmentEvents]

  const navItem = [
    {
      label: 'Schedule Calendar',
      url: '/admin/schedule-calendar',
    },
  ]

  return (
    <DefaultTemplate
      i18n={initPageResult.req?.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req?.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req?.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <SetStepNav nav={navItem} />
      <Gutter>
        <ScheduleCalendarClient events={allEvents} />
      </Gutter>
    </DefaultTemplate>
  )
}
