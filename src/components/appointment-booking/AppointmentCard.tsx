'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Repeat, User, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import type { Booking } from '@/payload-types'

interface AppointmentCardProps {
  appointment: Booking
  isPast?: boolean
  onReschedule?: (appointment: Booking) => void
  onCancel?: (appointment: Booking) => void
}

export function AppointmentCard({ appointment, isPast = false, onReschedule, onCancel }: AppointmentCardProps) {
  const startDate = typeof appointment.startTime === 'string' ? new Date(appointment.startTime) : appointment.startTime
  const endDate = typeof appointment.endTime === 'string' ? new Date(appointment.endTime) : appointment.endTime

  // Calculate duration in minutes
  const durationMs = endDate.getTime() - startDate.getTime()
  const durationMinutes = Math.round(durationMs / (1000 * 60))

  const isRecurring = !!appointment.recurringBookingUid
  const canReschedule = !isPast && appointment.status !== 'cancelled'
  const canCancel = !isPast && appointment.status !== 'cancelled'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left side - Appointment details */}
          <div className="flex-1 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">{appointment.title}</h3>
                  {isRecurring && (
                    <Badge variant="secondary" className="gap-1">
                      <Repeat className="h-3 w-3" />
                      Recurring
                    </Badge>
                  )}
                  {appointment.status === 'cancelled' && (
                    <Badge variant="destructive">Cancelled</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(startDate, 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(startDate, 'h:mm a')} ({durationMinutes} min)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.attendeeName}</span>
              </div>
              {appointment.location && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{appointment.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Actions */}
          {canCancel && (
            <div className="flex gap-2 sm:flex-col sm:items-end">
              {canReschedule ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReschedule?.(appointment)}
                    className="flex-1 sm:flex-none"
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCancel?.(appointment)}
                    className="flex-1 sm:flex-none text-destructive hover:text-destructive"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCancel?.(appointment)}
                    className="text-destructive hover:text-destructive"
                  >
                    {isRecurring ? 'Cancel Series' : 'Cancel'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
