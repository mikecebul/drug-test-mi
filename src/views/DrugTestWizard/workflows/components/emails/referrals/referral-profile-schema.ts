import { z } from 'zod'

export type ReferralClientType = 'court' | 'employer' | 'self'
export type ReferralTypeUi = 'court' | 'employer' | 'self'

export type RecipientDetail = {
  name?: string
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

export type PresetConfigMap = Record<
  string,
  {
    label: string
    recipients: ReadonlyArray<RecipientDetail>
  }
>

const recipientRowSchema = z.object({
  rowId: z.string().min(1),
  name: z.string().trim(),
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
  if (clientType === 'court') {
    return 'court'
  }

  if (clientType === 'employer') {
    return 'employer'
  }

  return 'self'
}

export function mapReferralTypeUiToClientType(referralTypeUi: ReferralTypeUi): ReferralClientType {
  if (referralTypeUi === 'court') {
    return 'court'
  }

  if (referralTypeUi === 'employer') {
    return 'employer'
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
      title: input.referralTitle || 'Self',
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
