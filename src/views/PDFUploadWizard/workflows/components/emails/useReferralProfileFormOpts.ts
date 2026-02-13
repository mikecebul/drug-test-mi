'use client'

import { formOptions } from '@tanstack/react-form'
import { toast } from 'sonner'
import { updateClientReferralProfile } from './updateClientReferralProfile'
import {
  mapReferralTypeUiToClientType,
  referralProfileSchema,
  type RecipientDetail,
  type ReferralClientType,
  type ReferralProfileFormValues,
} from './referral-profile-schema'

function normalizeRecipients(recipients: ReferralProfileFormValues['recipients']): RecipientDetail[] {
  const deduped = new Map<string, RecipientDetail>()

  for (const recipient of recipients) {
    const name = recipient.name.trim()
    const email = recipient.email.trim()
    const key = email.toLowerCase()

    if (!deduped.has(key)) {
      deduped.set(key, { name, email })
    }
  }

  return Array.from(deduped.values())
}

type UseReferralProfileFormOptsArgs = {
  clientId: string | null
  initialValues: ReferralProfileFormValues
  onClose: () => void
  onSaved: (data: {
    clientType: ReferralClientType
    referralTitle: string
    referralEmails: string[]
    referralRecipientsDetailed: RecipientDetail[]
  }) => void
}

export function useReferralProfileFormOpts({
  clientId,
  initialValues,
  onClose,
  onSaved,
}: UseReferralProfileFormOptsArgs) {
  return formOptions({
    defaultValues: initialValues,
    canSubmitWhenInvalid: true,
    validators: {
      onSubmit: ({ formApi }) => formApi.parseValuesWithSchema(referralProfileSchema),
    },
    onSubmit: async ({ value }) => {
      if (!clientId) {
        toast.error('Client is missing, cannot update referral profile')
        return
      }

      const recipients = normalizeRecipients(value.recipients)

      const result = await updateClientReferralProfile({
        clientId,
        clientType: mapReferralTypeUiToClientType(value.referralTypeUi),
        title: value.title.trim(),
        recipients,
      })

      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to update referral profile')
        return
      }

      onSaved({
        clientType: result.data.clientType,
        referralTitle: result.data.referralTitle,
        referralEmails: result.data.referralEmails,
        referralRecipientsDetailed: result.data.referralRecipientsDetailed,
      })

      toast.success('Referral profile updated')
      onClose()
    },
  })
}
