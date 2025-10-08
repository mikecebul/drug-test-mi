import { getPayload } from 'payload'
import config from '@payload-config'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { AppointmentsView } from './AppointmentsView'
import type { Booking, Appointment } from '@/payload-types'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function AppointmentsPage() {
  const payload = await getPayload({ config })
  const client = await getAuthenticatedClient()

  // Fetch CalCom bookings for this client
  const bookingsResult = await payload.find({
    collection: 'bookings',
    where: {
      relatedClient: {
        equals: client.id,
      },
      startTime: {
        greater_than: new Date().toISOString(), // Only future appointments
      },
    },
    sort: 'startTime',
    limit: 100,
  })

  // Fetch recurring appointments for this client
  const appointmentsResult = await payload.find({
    collection: 'appointments',
    where: {
      client: {
        equals: client.id,
      },
      isActive: {
        equals: true,
      },
    },
    sort: 'nextOccurrence',
    limit: 100,
  })

  // Get company contact info for the UI
  const companyInfo = await payload.findGlobal({
    slug: 'company-info',
  })

  return (
    <AppointmentsView
      bookings={bookingsResult.docs as Booking[]}
      recurringAppointments={appointmentsResult.docs as Appointment[]}
      contactPhone={companyInfo?.contact?.phone ?? undefined}
    />
  )
}
