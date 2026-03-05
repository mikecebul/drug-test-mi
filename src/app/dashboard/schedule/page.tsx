import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { CalInline } from '@/components/cal-inline'
import type { Client } from '@/payload-types'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

// Helper: Extract referral organization name based on client type
function getReferralName(client: Client): string | undefined {
  switch (client.referralType) {
    case 'court':
    case 'employer':
      if (client.referral && typeof client.referral === 'object' && 'value' in client.referral) {
        return typeof client.referral.value === 'object' ? client.referral.value?.name || undefined : undefined
      }
      return undefined
    case 'self':
    default:
      return undefined
  }
}

// Helper: Format phone for Cal.com (E.164 format)
function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined

  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Handle US phone numbers (10 digits)
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // Handle numbers that already have country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // Invalid format - don't prefill
  return undefined
}

export default async function SchedulePage() {
  const client = await getAuthenticatedClient()

  // Build Cal.com config with client data
  const calConfig: Record<string, unknown> = {
    name: `${client.firstName} ${client.lastName}`,
    email: client.email,
  }

  // Add phone if available
  const formattedPhone = formatPhone(client.phone)
  if (formattedPhone) {
    calConfig.attendeePhoneNumber = formattedPhone
  }

  // Add referral as title if available
  const referralName = getReferralName(client)
  if (referralName) {
    calConfig.title = referralName
  }

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
        <CalInline calUsername="midrugtest" config={calConfig} />
      </div>
    </div>
  )
}
