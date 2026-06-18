import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { CalInline } from '@/components/cal-inline'
import { getClientBookingCalLink } from '@/utilities/calcom-config'
import { buildClientBookingCalConfig } from '@/utilities/calcom-config.server'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const client = await getAuthenticatedClient()
  const calConfig = await buildClientBookingCalConfig(client)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-6 lg:px-10 xl:px-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Schedule Appointment</h1>
            <p className="text-muted-foreground">
              Select your preferred technician and schedule your drug test
            </p>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 max-w-3xl text-sm">
          MI Drug Test is introducing a 17-panel instant screen soon. Your referral’s selected test type will still
          determine what is prefilled when you book.
        </p>
      </div>

      <div className="px-6 lg:px-10 xl:px-12">
        <CalInline calUsername={getClientBookingCalLink(client)} config={calConfig} />
      </div>
    </div>
  )
}
