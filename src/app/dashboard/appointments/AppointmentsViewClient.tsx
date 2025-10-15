'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Plus } from 'lucide-react'
import { AppointmentCard } from '@/components/appointment-booking/AppointmentCard'
import { RescheduleDialog } from '@/components/appointment-booking/RescheduleDialog'
import { CancelDialog } from '@/components/appointment-booking/CancelDialog'
import { Button } from '@/components/ui/button'
import type { Booking } from '@/payload-types'
import { getRescheduleUrl } from '@/lib/calcom'
import { useRouter } from 'next/navigation'
import { TestWebhookButton } from '@/components/dev/TestWebhookButton'
import Link from 'next/link'

interface AppointmentsViewClientProps {
  bookings: Booking[]
  calcomUsername: string
  calcomEventSlug: string
  clientData: {
    name: string
    email: string
    phone: string
  }
}

export function AppointmentsViewClient({
  bookings,
  calcomUsername,
  calcomEventSlug,
  clientData,
}: AppointmentsViewClientProps) {
  const router = useRouter()
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Booking | null>(null)

  const handleReschedule = (appointment: Booking) => {
    setSelectedAppointment(appointment)
    setRescheduleDialogOpen(true)
  }

  const handleCancel = (appointment: Booking) => {
    setSelectedAppointment(appointment)
    setCancelDialogOpen(true)
  }

  const handleCancelSuccess = () => {
    // Refresh the page to get updated data
    router.refresh()
  }

  const now = new Date()

  const upcomingAppointments = bookings.filter((apt) => {
    const startTime = new Date(apt.startTime)
    return startTime >= now && apt.status !== 'cancelled'
  })

  const recurringAppointments = bookings.filter((apt) => {
    return !!apt.recurringBookingUid && apt.status !== 'cancelled'
  })

  const pastAppointments = bookings.filter((apt) => {
    const startTime = new Date(apt.startTime)
    return startTime < now || apt.status === 'cancelled'
  })

  // Generate reschedule URL for selected appointment
  const getRescheduleUrlForAppointment = (appointment: Booking) => {
    if (!appointment.calcomBookingId) return ''

    // Use the stored event slug if available, otherwise use the default
    const eventSlug = appointment.calcomEventSlug || calcomEventSlug

    return getRescheduleUrl({
      bookingUid: appointment.calcomBookingId,
      calcomUsername,
      eventSlug,
    })
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-foreground text-3xl font-semibold text-balance">My Appointments</h1>
            <p className="text-muted-foreground mt-2">Manage your upcoming and past appointments</p>
          </div>
          <div className="flex gap-2">
            {process.env.NODE_ENV === 'development' && (
              <TestWebhookButton
                clientEmail={clientData.email}
                clientName={clientData.name}
                clientPhone={clientData.phone}
              />
            )}
            <Button asChild size="lg" className="flex-shrink-0">
              <Link href="/dashboard/appointments/new">
                <Plus className="mr-2 h-5 w-5" />
                New Appointment
              </Link>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcomingAppointments.length})</TabsTrigger>
            <TabsTrigger value="recurring">Recurring ({recurringAppointments.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastAppointments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingAppointments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="text-muted-foreground mb-4 h-12 w-12" />
                  <p className="text-muted-foreground mb-4">No upcoming appointments</p>
                  <Button asChild>
                    <Link href="/dashboard/appointments/new">Schedule an Appointment</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              upcomingAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onReschedule={handleReschedule}
                  onCancel={handleCancel}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="recurring" className="space-y-4">
            {recurringAppointments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="text-muted-foreground mb-4 h-12 w-12" />
                  <p className="text-muted-foreground mb-4">No upcoming appointments</p>
                  <Button asChild>
                    <Link href="/dashboard/appointments/new">Schedule an Appointment</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              recurringAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onReschedule={handleReschedule}
                  onCancel={handleCancel}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastAppointments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="text-muted-foreground mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">No past appointments</p>
                </CardContent>
              </Card>
            ) : (
              pastAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} isPast />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {selectedAppointment && (
        <>
          <RescheduleDialog
            open={rescheduleDialogOpen}
            onOpenChange={setRescheduleDialogOpen}
            appointment={selectedAppointment}
            rescheduleUrl={getRescheduleUrlForAppointment(selectedAppointment)}
          />
          <CancelDialog
            open={cancelDialogOpen}
            onOpenChange={setCancelDialogOpen}
            appointment={selectedAppointment}
            onSuccess={handleCancelSuccess}
          />
        </>
      )}
    </div>
  )
}
