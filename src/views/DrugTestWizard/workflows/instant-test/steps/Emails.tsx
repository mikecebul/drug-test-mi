'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { getInstantTestFormOpts } from '../shared-form'
import { useInstantTestEmailPreview } from '../../components/emails/useInstantTestEmailPreview'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { invalidateWizardClientDerivedData } from '../../../queries'

export const EmailsStep = withForm({
  ...getInstantTestFormOpts('reviewEmails'),

  render: function Render({ form }) {
    const queryClient = useQueryClient()
    const [showReferralPreview, setShowReferralPreview] = useState(false)
    const lastClientIdRef = useRef<string | null>(null)
    const lastPreviewHashRef = useRef<string>('')

    // Get typed form values
    const formValues = useStore(form.store, (state) => state.values)

    // Use instant test email preview hook - returns both client and referral email data
    const { previewData, isLoading, error, refetch } = useInstantTestEmailPreview({
      clientId: formValues?.client?.id,
      testType: formValues?.verifyData?.testType,
      collectionDate: formValues?.verifyData?.collectionDate,
      detectedSubstances: (formValues?.verifyData?.detectedSubstances || []) as SubstanceValue[],
      isDilute: formValues?.verifyData?.isDilute || false,
      breathalyzerTaken: formValues?.verifyData?.breathalyzerTaken,
      breathalyzerResult: formValues?.verifyData?.breathalyzerResult,
      confirmationDecision: formValues?.verifyData?.confirmationDecision,
      medications: formValues?.medications,
    })

    // Initialize and sync recipients without clobbering manual edits.
    useEffect(() => {
      if (!previewData) {
        return
      }

      const clientId = formValues?.client?.id || null
      const nextClientRecipients = previewData.clientEmail ? [previewData.clientEmail] : []
      const shouldDisableSelfReferralByDefault =
        previewData.clientType === 'self' && previewData.hasExplicitReferralRecipients === false
      const nextReferralRecipients = shouldDisableSelfReferralByDefault ? [] : previewData.referralEmails
      const previewHash = JSON.stringify({
        clientEmail: previewData.clientEmail || '',
        referralEmails: nextReferralRecipients,
        hasExplicitReferralRecipients: previewData.hasExplicitReferralRecipients,
      })
      const clientChanged = lastClientIdRef.current !== clientId
      const previewChanged = lastPreviewHashRef.current !== previewHash
      const clientRecipientsEmpty = formValues.emails.clientRecipients.length === 0
      const referralRecipientsEmpty = formValues.emails.referralRecipients.length === 0

      if (clientChanged) {
        form.setFieldValue('emails.clientRecipients', nextClientRecipients)
        form.setFieldValue('emails.clientEmailEnabled', nextClientRecipients.length > 0)
        form.setFieldValue('emails.referralRecipients', nextReferralRecipients)
        form.setFieldValue('emails.referralEmailEnabled', nextReferralRecipients.length > 0)
      } else if (previewChanged) {
        if (clientRecipientsEmpty) {
          form.setFieldValue('emails.clientRecipients', nextClientRecipients)
          form.setFieldValue('emails.clientEmailEnabled', nextClientRecipients.length > 0)
        }

        if (referralRecipientsEmpty) {
          form.setFieldValue('emails.referralRecipients', nextReferralRecipients)
          form.setFieldValue('emails.referralEmailEnabled', nextReferralRecipients.length > 0)
        }
      }

      lastClientIdRef.current = clientId
      lastPreviewHashRef.current = previewHash
    }, [
      previewData,
      formValues.client?.id,
      formValues.emails.clientRecipients.length,
      formValues.emails.referralRecipients.length,
      form,
    ])

    const handleReferralProfileSaved = useCallback(async () => {
      invalidateWizardClientDerivedData(queryClient, { clientId: formValues?.client?.id || null })
      await refetch()
    }, [formValues?.client?.id, queryClient, refetch])

    return (
      <EmailsFieldGroup
        form={form}
        fields="emails"
        previewData={previewData}
        isLoading={isLoading}
        error={error}
        showPreview={showReferralPreview}
        setShowPreview={setShowReferralPreview}
        showClientEmail={true}
        title="Review Emails"
        description="Review and configure email notifications"
        clientId={formValues?.client?.id || null}
        onReferralProfileSaved={handleReferralProfileSaved}
        onClientEmailSaved={handleReferralProfileSaved}
      />
    )
  },
})
