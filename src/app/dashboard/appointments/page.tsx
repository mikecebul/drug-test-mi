import { getPayload } from 'payload'
import config from '@payload-config'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { AppointmentsViewClient } from './AppointmentsViewClient'
import type { Booking } from '@/payload-types'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function AppointmentsPage() {
  const payload = await getPayload({ config })
  const client = await getAuthenticatedClient()

  // Fetch all bookings for this client (both past and future)
  const bookingsResult = await payload.find({
    collection: 'bookings',
    where: {
      relatedClient: {
        equals: client.id,
      },
    },
    sort: '-startTime', // Most recent first
    limit: 100,
  })

  // Get company info for tests configuration and Cal.com username
  const companyInfo = await payload.findGlobal({
    slug: 'company-info',
  })


  // Prepare client data for prefill
  const clientData = {
    name: `${client.firstName} ${client.lastName}`,
    email: client.email,
    phone: client.phone || '',
  }

  // Cal.com configuration
  const calcomUsername = process.env.NEXT_PUBLIC_CALCOM_USERNAME || 'mike-midrugtest'
  const calcomEventSlug = process.env.NEXT_PUBLIC_CALCOM_EVENT_SLUG || 'drug-test'

  return (
    <AppointmentsViewClient
      bookings={bookingsResult.docs as Booking[]}
      calcomUsername={calcomUsername}
      calcomEventSlug={calcomEventSlug}
      clientData={clientData}
    />
  )
}
