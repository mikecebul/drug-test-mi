import type { Court, Employer } from '@/payload-types'

export type RecipientInfo = {
  name?: string
  email: string
}

export type ReferralOption = {
  id: string
  name: string
  contacts: RecipientInfo[]
  recipientEmails: string[]
  preferredTestTypeLabel?: string
}

export type EmployerOption = ReferralOption

export type CourtOption = ReferralOption

export type EmployerRecord = Omit<Pick<Employer, 'id' | 'name' | 'contacts' | 'preferredTestType'>, 'preferredTestType'> &
  {
    preferredTestType?: unknown
    contactName?: string | null
    contactEmail?: string | null
    contacts?: Array<{ name?: string | null; email?: string | null }> | null
    mainContactName?: string | null
    mainContactEmail?: string | null
    recipientEmails?: Array<{ email?: string | null }> | null
  }

export type CourtRecord = Omit<Pick<Court, 'id' | 'name' | 'contacts' | 'preferredTestType'>, 'preferredTestType'> &
  {
    preferredTestType?: unknown
    mainContactName?: string | null
    mainContactEmail?: string | null
    recipientEmails?: Array<{ email?: string | null }> | null
  }
