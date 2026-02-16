'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { getCollectLabFormOpts } from '../shared-form'
import { useEmailPreview } from '../../components/emails/useEmailPreview'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'
import { invalidateWizardClientDerivedData } from '../../../queries'

export const EmailsStep = withForm({
  ...getCollectLabFormOpts('reviewEmails'),

  render: function Render({ form }) {
    const queryClient = useQueryClient()
    const [showReferralPreview, setShowReferralPreview] = useState(false)
    const lastClientIdRef = useRef<string | null>(null)
    const lastPreviewRecipientsHashRef = useRef<string>('')

    // Get typed form values
    const formValues = useStore(form.store, (state) => state.values)

    // Use email preview hook
    const { previewData, isLoading, error, refetch } = useEmailPreview({
      clientId: formValues?.client?.id,
      testType: formValues?.collection?.testType,
      collectionDate: formValues?.collection?.collectionDate,
      breathalyzerTaken: formValues?.collection?.breathalyzerTaken,
      breathalyzerResult: formValues?.collection?.breathalyzerResult,
    })

    // Initialize and sync referral recipients without clobbering manual edits.
    useEffect(() => {
      if (!previewData) {
        return
      }

      const clientId = formValues?.client?.id || null
      const shouldDisableSelfReferralByDefault =
        previewData.clientType === 'self' && previewData.hasExplicitReferralRecipients === false
      const nextReferralRecipients = shouldDisableSelfReferralByDefault ? [] : previewData.referralEmails
      const previewRecipientsHash = JSON.stringify({
        referralEmails: nextReferralRecipients,
        hasExplicitReferralRecipients: previewData.hasExplicitReferralRecipients,
      })
      const clientChanged = lastClientIdRef.current !== clientId
      const previewChanged = lastPreviewRecipientsHashRef.current !== previewRecipientsHash
      const recipientsEmpty = formValues.emails.referralRecipients.length === 0

      if (clientChanged) {
        form.setFieldValue('emails.referralRecipients', nextReferralRecipients)
        form.setFieldValue('emails.referralEmailEnabled', nextReferralRecipients.length > 0)
      } else if (previewChanged && recipientsEmpty) {
        form.setFieldValue('emails.referralRecipients', nextReferralRecipients)
        form.setFieldValue('emails.referralEmailEnabled', nextReferralRecipients.length > 0)
      }

      lastClientIdRef.current = clientId
      lastPreviewRecipientsHashRef.current = previewRecipientsHash
    }, [previewData, formValues.client?.id, formValues.emails.referralRecipients.length, form])

    const handleReferralProfileSaved = useCallback(async () => {
      invalidateWizardClientDerivedData(queryClient, { clientId: formValues?.client?.id || null })
      await refetch()
    }, [formValues?.client?.id, queryClient, refetch])

    return (
      <EmailsFieldGroup
        form={form}
        fields="emails"
        title="Review Collection Notification"
        description="Configure email notifications for this collection"
        previewData={previewData}
        isLoading={isLoading}
        error={error}
        showPreview={showReferralPreview}
        setShowPreview={setShowReferralPreview}
        showClientEmail={false}
        clientId={formValues?.client?.id || null}
        onReferralProfileSaved={handleReferralProfileSaved}
        onClientEmailSaved={handleReferralProfileSaved}
      />
    )
  },
})
