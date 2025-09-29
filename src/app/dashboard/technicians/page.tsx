import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SchedulePageClient } from '@/blocks/SchedulePage/Component.client'

async function getScheduleData() {
  const headersList = await headers()
  const payload = await getPayload({ config })

  // Get authenticated user
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    redirect('/sign-in?redirect=/dashboard/technicians')
  }

  if (user.collection !== 'clients') {
    redirect('/admin')
  }

  // Fetch all active technicians
  const technicians = await payload.find({
    collection: 'technicians',
    where: {
      isActive: {
        equals: true,
      },
    },
    depth: 2,
  })

  return {
    technicians: technicians.docs,
  }
}

export default async function SchedulePage() {
  try {
    const { technicians } = await getScheduleData()

    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Schedule Appointment</h1>
              <p className="text-muted-foreground">
                Select your preferred technician and schedule your drug test
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <SchedulePageClient
            title="Select Your Technician"
            technicians={technicians}
          />
        </div>
      </div>
    )
  } catch (error) {
    // Handle access denied or other errors
    redirect('/sign-in?redirect=/dashboard/technicians')
  }
}