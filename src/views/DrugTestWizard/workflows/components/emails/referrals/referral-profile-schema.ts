import { z } from 'zod'
import { COURT_CONFIGS, EMPLOYER_CONFIGS } from '@/app/(frontend)/register/configs/recipient-configs'

export type ReferralClientType = 'probation' | 'employment' | 'self'
export type ReferralTypeUi = 'court' | 'employer' | 'self'

export type RecipientDetail = {
  name: string
  email: string
}

export type ReferralRecipientRow = {
  rowId: string
  name: string
  email: string
}

export type ReferralProfileFormValues = {
  referralTypeUi: ReferralTypeUi
  presetKey: string
  title: string
  recipients: ReferralRecipientRow[]
}

type PresetConfigMap = Record<
  string,
  {
    label: string
    recipients: ReadonlyArray<RecipientDetail>
  }
>

const recipientRowSchema = z.object({
  rowId: z.string().min(1),
  name: z.string().trim().min(1, 'Recipient name is required'),
  email: z.string().trim().email('Recipient email is invalid'),
})

export const referralProfileSchema = z
  .object({
    referralTypeUi: z.enum(['court', 'employer', 'self']),
    presetKey: z.string(),
    title: z.string().trim().min(1, 'Referral name is required'),
    recipients: z.array(recipientRowSchema),
  })
  .superRefine((data, ctx) => {
    if (data.referralTypeUi !== 'self' && data.recipients.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one recipient is required',
        path: ['recipients'],
      })
    }

    const seenEmails = new Map<string, number>()

    data.recipients.forEach((recipient, index) => {
      const key = recipient.email.trim().toLowerCase()
      const duplicateIndex = seenEmails.get(key)

      if (duplicateIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate email address',
          path: ['recipients', index, 'email'],
        })
        return
      }

      seenEmails.set(key, index)
    })
  })

export function mapClientTypeToReferralTypeUi(clientType?: ReferralClientType): ReferralTypeUi {
  if (clientType === 'probation') {
    return 'court'
  }

  if (clientType === 'employment') {
    return 'employer'
  }

  return 'self'
}

export function mapReferralTypeUiToClientType(referralTypeUi: ReferralTypeUi): ReferralClientType {
  if (referralTypeUi === 'court') {
    return 'probation'
  }

  if (referralTypeUi === 'employer') {
    return 'employment'
  }

  return 'self'
}

function createRowId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `recipient-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createRecipientRow(recipient?: Partial<RecipientDetail>): ReferralRecipientRow {
  return {
    rowId: createRowId(),
    name: recipient?.name ?? '',
    email: recipient?.email ?? '',
  }
}

export function getPresetConfigsForUiType(referralTypeUi: ReferralTypeUi): PresetConfigMap | null {
  if (referralTypeUi === 'court') {
    return COURT_CONFIGS as PresetConfigMap
  }

  if (referralTypeUi === 'employer') {
    return EMPLOYER_CONFIGS as PresetConfigMap
  }

  return null
}

export function buildInitialReferralProfileValues(input: {
  clientType?: ReferralClientType
  referralTitle?: string
  referralRecipientsDetailed?: RecipientDetail[]
  fallbackReferralEmails?: string[]
}): ReferralProfileFormValues {
  const referralTypeUi = mapClientTypeToReferralTypeUi(input.clientType)
  const detailedRecipients = input.referralRecipientsDetailed?.filter((recipient) => recipient.email.trim()) || []

  const recipients =
    detailedRecipients.length > 0
      ? detailedRecipients.map((recipient) => createRecipientRow(recipient))
      : (input.fallbackReferralEmails || []).filter(Boolean).map((email) => createRecipientRow({ email }))

  if (referralTypeUi === 'self' && recipients.length === 0) {
    return {
      referralTypeUi,
      presetKey: 'custom',
      title: input.referralTitle || '',
      recipients: [],
    }
  }

  return {
    referralTypeUi,
    presetKey: 'custom',
    title: input.referralTitle || '',
    recipients: recipients.length > 0 ? recipients : [createRecipientRow()],
  }
}
