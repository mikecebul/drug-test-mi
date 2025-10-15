import { redirect } from 'next/navigation'
import { SchedulePageClient } from '@/blocks/SchedulePage/Component.client'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { CalEmbed } from '@/components/cal-embed'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  try {
    await getAuthenticatedClient()

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

        <CalEmbed calUsername="midrugtest" />
      </div>
    )
  } catch (error) {
    // Handle access denied or other errors
    redirect('/sign-in?redirect=/dashboard/technicians')
  }
}
