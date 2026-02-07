import type { ServerComponentProps } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { QuickBookButtonClient } from './QuickBookButton.client'

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

/**
 * Server component that fetches client data and builds Cal.com config
 * for the Quick Book button in the Clients collection edit view.
 */
export default async function QuickBookButton({ id }: ServerComponentProps) {
  // Don't render on new document creation (no ID yet)
  if (!id) {
    return null
  }

  try {
    const payload = await getPayload({ config })

    // Fetch client data
    const client = await payload.findByID({
      collection: 'clients',
      id: id.toString(),
      depth: 1,
    })

    if (!client) {
      console.error('[QuickBookButton] Client not found:', id)
      return null
    }

    // Validate required fields
    if (!client.firstName?.trim() || !client.lastName?.trim()) {
      console.error('[QuickBookButton] Client missing required name fields')
      return null
    }

    if (!client.email?.trim() || !client.email.includes('@')) {
      console.error('[QuickBookButton] Client has invalid email')
      return null
    }

    // Build base config
    const name = `${client.firstName.trim()} ${client.lastName.trim()}`
    const email = client.email.trim()
    const formattedPhone = formatPhone(client.phone)

    // Render client component with client data
    return (
      <QuickBookButtonClient
        clientName={name}
        clientEmail={email}
        clientPhone={formattedPhone}
      />
    )
  } catch (error) {
    // Gracefully handle errors (e.g., incomplete profile)
    console.error('[QuickBookButton] Error preparing client data:', error)

    // Return null to hide button if profile is incomplete
    return null
  }
}
