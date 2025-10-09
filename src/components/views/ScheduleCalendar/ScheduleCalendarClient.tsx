'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { BigCalendar, dateFnsLocalizer, View } from '@/components/ui/big-calendar'
import { format as formatDate, parse, startOfWeek, getDay } from 'date-fns'
import enUS from 'date-fns/locale/en-US'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarIcon, Clock, CreditCard, User, Filter, X } from 'lucide-react'
import { format, isSameMonth } from 'date-fns'
import type { CalendarEvent, RBCEvent } from './types'
import { calendarEventsToRBC } from './utils'

// Setup the localizer for React Big Calendar
const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format: formatDate,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface ScheduleCalendarClientProps {
  events: CalendarEvent[]
}

export function ScheduleCalendarClient({ events }: ScheduleCalendarClientProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [currentView, setCurrentView] = useState<View>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'booking' | 'recurring'>('all')
  const [filterPrepaid, setFilterPrepaid] = useState<'all' | 'prepaid' | 'unpaid'>('all')

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filterType !== 'all' && event.type !== filterType) return false
      if (filterPrepaid === 'prepaid' && !event.isPrepaid) return false
      if (filterPrepaid === 'unpaid' && event.isPrepaid) return false
      return true
    })
  }, [events, filterType, filterPrepaid])

  // Convert to RBC format
  const rbcEvents = useMemo(() => calendarEventsToRBC(filteredEvents), [filteredEvents])

  // Count different types for stats
  const stats = useMemo(() => {
    const currentMonthEvents = filteredEvents.filter(event => isSameMonth(event.date, currentDate))
    return {
      total: currentMonthEvents.length,
      oneTime: currentMonthEvents.filter((e) => e.type === 'booking').length,
      recurring: currentMonthEvents.filter((e) => e.type === 'recurring').length,
      prepaid: currentMonthEvents.filter((e) => e.isPrepaid).length,
    }
  }, [filteredEvents, currentDate])

  // Event style getter for color coding
  const eventStyleGetter = useCallback((event: RBCEvent) => {
    const resource = event.resource
    let backgroundColor = 'hsl(var(--primary))'
    let borderColor = 'hsl(var(--primary))'

    // Color by type
    if (resource.type === 'recurring') {
      backgroundColor = 'hsl(217 91% 60%)' // Blue for recurring
      borderColor = 'hsl(217 91% 50%)'
    } else if (resource.type === 'booking') {
      backgroundColor = 'hsl(142 76% 36%)' // Green for one-time bookings
      borderColor = 'hsl(142 76% 30%)'
    }

    // Adjust for payment status
    if (!resource.isPrepaid) {
      backgroundColor = `${backgroundColor.replace(')', ' / 0.7)')}`  // More transparent for unpaid
    }

    // Cancelled events
    if (resource.status === 'cancelled') {
      backgroundColor = 'hsl(var(--destructive) / 0.5)'
      borderColor = 'hsl(var(--destructive))'
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '4px',
        opacity: resource.status === 'cancelled' ? 0.6 : 1,
      },
    }
  }, [])

  // Event click handler
  const handleSelectEvent = useCallback((event: RBCEvent) => {
    setSelectedEvent(event.resource)
  }, [])

  // Navigate handler
  const handleNavigate = useCallback((newDate: Date) => {
    setCurrentDate(newDate)
  }, [])

  // View change handler
  const handleViewChange = useCallback((newView: View) => {
    setCurrentView(newView)
  }, [])

  // Custom event component for month view
  const EventComponent = ({ event }: { event: RBCEvent }) => {
    const resource = event.resource
    return (
      <div className="flex items-center gap-1 text-xs overflow-hidden">
        <span className="font-medium truncate">{event.title}</span>
        {resource.isPrepaid && <CreditCard className="h-3 w-3 flex-shrink-0" />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule Calendar</h1>
        <p className="text-muted-foreground">View all bookings and recurring appointments</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total This Month</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>One-Time Bookings</CardDescription>
            <CardTitle className="text-3xl">{stats.oneTime}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recurring Appointments</CardDescription>
            <CardTitle className="text-3xl">{stats.recurring}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prepaid</CardDescription>
            <CardTitle className="text-3xl">{stats.prepaid}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <div className="flex gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              All Types
            </Button>
            <Button
              variant={filterType === 'booking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('booking')}
            >
              One-Time Only
            </Button>
            <Button
              variant={filterType === 'recurring' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('recurring')}
            >
              Recurring Only
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterPrepaid === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterPrepaid('all')}
            >
              All Payment
            </Button>
            <Button
              variant={filterPrepaid === 'prepaid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterPrepaid('prepaid')}
            >
              Prepaid Only
            </Button>
            <Button
              variant={filterPrepaid === 'unpaid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterPrepaid('unpaid')}
            >
              Unpaid Only
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Big Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
            <CardDescription>
              {format(currentDate, 'MMMM yyyy')} • {filteredEvents.length} appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[700px]">
              <BigCalendar
                localizer={localizer}
                events={rbcEvents}
                startAccessor="start"
                endAccessor="end"
                view={currentView}
                onView={handleViewChange}
                date={currentDate}
                onNavigate={handleNavigate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                components={{
                  event: EventComponent,
                }}
                popup
                selectable
                style={{ height: '100%' }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Selected Event Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Event Details
              </span>
              {selectedEvent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedEvent(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              {selectedEvent ? 'Click to view full details' : 'Select an event to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[650px] overflow-y-auto">
            {!selectedEvent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mb-2 opacity-50" />
                <p>No event selected</p>
                <p className="text-xs mt-2">Click on an event in the calendar to see details</p>
              </div>
            ) : (
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{selectedEvent.title}</h4>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <User className="h-3 w-3" />
                          <span>{selectedEvent.clientName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {selectedEvent.clientEmail}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {selectedEvent.isRecurring ? (
                          <Badge variant="outline" className="text-xs">
                            {selectedEvent.frequency === 'weekly' && 'Weekly'}
                            {selectedEvent.frequency === 'biweekly' && 'Bi-weekly'}
                            {selectedEvent.frequency === 'monthly' && 'Monthly'}
                            {selectedEvent.frequency === 'custom' && 'Custom'}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            One-Time
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-3 text-sm">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{format(selectedEvent.date, 'EEEE, MMMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {selectedEvent.time} ({selectedEvent.duration || 30} minutes)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                      {selectedEvent.isPrepaid ? (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          Prepaid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Payment Required
                        </Badge>
                      )}

                      {selectedEvent.status && (
                        <Badge
                          variant={
                            selectedEvent.status === 'confirmed'
                              ? 'secondary'
                              : selectedEvent.status === 'cancelled'
                                ? 'destructive'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
                        </Badge>
                      )}

                      {selectedEvent.paymentStatus && (
                        <Badge
                          variant={
                            selectedEvent.paymentStatus === 'active'
                              ? 'secondary'
                              : selectedEvent.paymentStatus === 'past_due'
                                ? 'destructive'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {selectedEvent.paymentStatus === 'active' && 'Active'}
                          {selectedEvent.paymentStatus === 'past_due' && 'Past Due'}
                          {selectedEvent.paymentStatus === 'canceled' && 'Canceled'}
                          {selectedEvent.paymentStatus === 'pending' && 'Pending'}
                        </Badge>
                      )}
                    </div>

                    <div className="pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const collection = selectedEvent.type === 'booking' ? 'bookings' : 'appointments'
                          const id = selectedEvent.type === 'booking' ? selectedEvent.id : selectedEvent.id.split('-')[0]
                          window.open(`/admin/collections/${collection}/${id}`, '_blank')
                        }}
                      >
                        Open in Admin →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(217 91% 60%)' }} />
            <span className="text-sm">Recurring appointments</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(142 76% 36%)' }} />
            <span className="text-sm">One-time bookings</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Prepaid
            </Badge>
            <span className="text-sm">Payment received</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded opacity-60" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
            <span className="text-sm">Cancelled</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
