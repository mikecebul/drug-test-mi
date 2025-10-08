'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, CreditCard, AlertCircle } from 'lucide-react'
import type { Booking, Appointment } from '@/payload-types'

interface AppointmentsViewProps {
  bookings: Booking[]
  recurringAppointments: Appointment[]
  contactPhone?: string
}

// Helper to format date and time
function formatDateTime(date: string | Date): { date: string; time: string } {
  const d = new Date(date)
  return {
    date: d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  }
}

// Calculate next occurrence for recurring appointment
function getNextOccurrence(appointment: Appointment): Date | null {
  if (appointment.nextOccurrence) {
    return new Date(appointment.nextOccurrence)
  }

  // If no nextOccurrence is set, calculate from startDate
  const startDate = new Date(appointment.startDate)
  const now = new Date()

  if (startDate > now) {
    return startDate
  }

  // Simple calculation based on frequency
  let nextDate = new Date(startDate)

  switch (appointment.frequency) {
    case 'weekly':
      while (nextDate < now) {
        nextDate.setDate(nextDate.getDate() + 7)
      }
      break
    case 'biweekly':
      while (nextDate < now) {
        nextDate.setDate(nextDate.getDate() + 14)
      }
      break
    case 'monthly':
      while (nextDate < now) {
        nextDate.setMonth(nextDate.getMonth() + 1)
      }
      break
  }

  return nextDate
}

export function AppointmentsView({ bookings, recurringAppointments, contactPhone }: AppointmentsViewProps) {
  // Combine and sort all appointments
  const allAppointments = useMemo(() => {
    const combined: Array<{
      id: string
      title: string
      date: Date
      time: string
      duration?: number
      isPrepaid: boolean
      isRecurring: boolean
      status?: string
      frequency?: string
      paymentStatus?: string
    }> = []

    // Add CalCom bookings
    bookings.forEach((booking) => {
      combined.push({
        id: booking.id,
        title: booking.title,
        date: new Date(booking.startTime),
        time: formatDateTime(booking.startTime).time,
        duration: parseInt(booking.type.replace(/\D/g, '')) || 30,
        isPrepaid: booking.isPrepaid || false,
        isRecurring: false,
        status: booking.status,
      })
    })

    // Add recurring appointments
    recurringAppointments.forEach((appointment) => {
      const nextOccurrence = getNextOccurrence(appointment)
      if (nextOccurrence) {
        combined.push({
          id: appointment.id,
          title: appointment.title,
          date: nextOccurrence,
          time: appointment.time,
          duration: appointment.duration,
          isPrepaid: appointment.isPrepaid || false,
          isRecurring: true,
          frequency: appointment.frequency,
          paymentStatus: appointment.paymentStatus,
        })
      }
    })

    // Sort by date
    return combined.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [bookings, recurringAppointments])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground">View your upcoming appointments</p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>
              {allAppointments.length === 0
                ? 'No upcoming appointments scheduled'
                : `You have ${allAppointments.length} upcoming appointment${allAppointments.length === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No upcoming appointments</p>
                <p className="text-sm text-muted-foreground">
                  Book an appointment to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {allAppointments.map((appointment) => {
                  const { date, time } = formatDateTime(appointment.date)

                  return (
                    <Card key={appointment.id} className="border-l-4 border-l-primary">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start gap-3">
                              <Calendar className="h-5 w-5 text-primary mt-0.5" />
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{appointment.title}</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>{date}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>
                                      {appointment.time} ({appointment.duration || 30} min)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 md:justify-end">
                            {/* Payment Status */}
                            {appointment.isPrepaid ? (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                Prepaid
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Payment Required
                              </Badge>
                            )}

                            {/* Recurring Badge */}
                            {appointment.isRecurring && (
                              <Badge variant="outline">
                                {appointment.frequency === 'weekly' && 'Weekly'}
                                {appointment.frequency === 'biweekly' && 'Bi-weekly'}
                                {appointment.frequency === 'monthly' && 'Monthly'}
                                {appointment.frequency === 'custom' && 'Custom'}
                              </Badge>
                            )}

                            {/* Booking Status */}
                            {appointment.status && (
                              <Badge
                                variant={
                                  appointment.status === 'confirmed'
                                    ? 'secondary'
                                    : appointment.status === 'cancelled'
                                      ? 'destructive'
                                      : 'outline'
                                }
                              >
                                {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                              </Badge>
                            )}

                            {/* Payment Status for recurring */}
                            {appointment.isRecurring && appointment.paymentStatus && (
                              <Badge
                                variant={
                                  appointment.paymentStatus === 'active'
                                    ? 'secondary'
                                    : appointment.paymentStatus === 'past_due'
                                      ? 'destructive'
                                      : 'outline'
                                }
                              >
                                {appointment.paymentStatus === 'active' && 'Active'}
                                {appointment.paymentStatus === 'past_due' && 'Past Due'}
                                {appointment.paymentStatus === 'canceled' && 'Canceled'}
                                {appointment.paymentStatus === 'pending' && 'Pending'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Payment warning for unprepaid appointments */}
                        {!appointment.isPrepaid && (
                          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                              <div className="text-sm">
                                <p className="font-medium text-amber-900">Payment required</p>
                                <p className="text-amber-700 mt-0.5">
                                  Please arrange payment before your appointment.
                                  {contactPhone && (
                                    <>
                                      {' '}Call{' '}
                                      <a
                                        href={`tel:${contactPhone.replace(/\D/g, '')}`}
                                        className="underline font-medium"
                                      >
                                        {contactPhone}
                                      </a>{' '}
                                      for details.
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Information Card */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>About Your Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CreditCard className="h-4 w-4 text-primary mt-1" />
                <div>
                  <p className="font-medium">Prepaid Appointments</p>
                  <p className="text-sm text-muted-foreground">
                    Appointments booked through our online system are prepaid via Stripe.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-primary mt-1" />
                <div>
                  <p className="font-medium">Recurring Appointments</p>
                  <p className="text-sm text-muted-foreground">
                    Recurring appointments are set up by our staff. Contact us to set up or modify recurring appointments.
                  </p>
                </div>
              </div>
            </div>
            {contactPhone && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Questions? Call us at{' '}
                  <a
                    href={`tel:${contactPhone.replace(/\D/g, '')}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {contactPhone}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
