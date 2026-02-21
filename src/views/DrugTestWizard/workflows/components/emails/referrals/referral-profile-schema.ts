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
  additionalRecipients: ReferralRecipientRow[]
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
    additionalRecipients: z.array(recipientRowSchema),
  })
  .superRefine((data, ctx) => {
    if (data.referralTypeUi !== 'self' && data.recipients.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one recipient is required',
        path: ['recipients'],
      })
    }

    const recipientEmailMap = new Map<string, number>()

    data.recipients.forEach((recipient, index) => {
      const key = recipient.email.trim().toLowerCase()
      const duplicateIndex = recipientEmailMap.get(key)

      if (duplicateIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate email address',
          path: ['recipients', index, 'email'],
        })
        return
      }

      recipientEmailMap.set(key, index)
    })

    const additionalEmailMap = new Map<string, number>()

    data.additionalRecipients.forEach((recipient, index) => {
      const key = recipient.email.trim().toLowerCase()
      const duplicateIndex = additionalEmailMap.get(key)

      if (duplicateIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate email address',
          path: ['additionalRecipients', index, 'email'],
        })
        return
      }

      additionalEmailMap.set(key, index)

      if (data.referralTypeUi !== 'self' && recipientEmailMap.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Already included in referral recipients',
          path: ['additionalRecipients', index, 'email'],
        })
      }
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
  referralPresetId?: string
  referralTitle?: string
  referralRecipientsDetailed?: RecipientDetail[]
  clientAdditionalRecipientsDetailed?: RecipientDetail[]
  fallbackReferralEmails?: string[]
}): ReferralProfileFormValues {
  const referralTypeUi = mapClientTypeToReferralTypeUi(input.clientType)
  const allRecipients = input.referralRecipientsDetailed?.filter((recipient) => recipient.email.trim()) || []
  const additionalRecipientsDetailed =
    input.clientAdditionalRecipientsDetailed?.filter((recipient) => recipient.email.trim()) || []
  const additionalEmailSet = new Set(additionalRecipientsDetailed.map((recipient) => recipient.email.trim().toLowerCase()))
  const baseRecipientsDetailed = allRecipients.filter(
    (recipient) => !additionalEmailSet.has(recipient.email.trim().toLowerCase()),
  )
  const fallbackBaseEmails = (input.fallbackReferralEmails || []).filter(
    (email) => email.trim() && !additionalEmailSet.has(email.trim().toLowerCase()),
  )

  const recipients = (
    baseRecipientsDetailed.length > 0
      ? baseRecipientsDetailed.map((recipient) => createRecipientRow(recipient))
      : fallbackBaseEmails.map((email) => createRecipientRow({ email }))
  )
  const additionalRecipients = additionalRecipientsDetailed.map((recipient) => createRecipientRow(recipient))

  if (referralTypeUi === 'self') {
    const selfRecipients = additionalRecipientsDetailed.map((recipient) => createRecipientRow(recipient))

    return {
      referralTypeUi,
      presetKey: 'custom',
      title: input.referralTitle || 'Self',
      recipients: selfRecipients,
      additionalRecipients: [],
    }
  }

  return {
    referralTypeUi,
    presetKey: input.referralPresetId || 'custom',
    title: input.referralTitle || '',
    recipients: recipients.length > 0 ? recipients : [createRecipientRow()],
    additionalRecipients,
  }
}
