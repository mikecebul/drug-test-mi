'use client'

import { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { getInstantTestFormOpts } from '../shared-form'
import { useInstantTestEmailPreview } from '../../components/emails/useInstantTestEmailPreview'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'
import type { SubstanceValue } from '@/fields/substanceOptions'

export const EmailsStep = withForm({
  ...getInstantTestFormOpts('reviewEmails'),

  render: function Render({ form }) {
    const [showReferralPreview, setShowReferralPreview] = useState(false)

    // Get typed form values
    const formValues = useStore(form.store, (state) => state.values)

    // Use instant test email preview hook - returns both client and referral email data
    const { previewData, isLoading, error } = useInstantTestEmailPreview({
      clientId: formValues?.client?.id,
      testType: formValues?.verifyData?.testType,
      collectionDate: formValues?.verifyData?.collectionDate,
      detectedSubstances: (formValues?.verifyData?.detectedSubstances || []) as SubstanceValue[],
      isDilute: formValues?.verifyData?.isDilute || false,
      breathalyzerTaken: formValues?.verifyData?.breathalyzerTaken,
      breathalyzerResult: formValues?.verifyData?.breathalyzerResult,
      confirmationDecision: formValues?.verifyData?.confirmationDecision,
    })

    // Initialize form fields when preview data loads
    useEffect(() => {
      if (previewData) {
        // Initialize client email if available
        if (previewData.clientEmail) {
          form.setFieldValue('emails.clientEmailEnabled', true)
          form.setFieldValue('emails.clientRecipients', [previewData.clientEmail])
        }
        // Initialize referral emails
        form.setFieldValue('emails.referralEmailEnabled', true)
        form.setFieldValue('emails.referralRecipients', previewData.referralEmails)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewData])

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
      />
    )
  },
})
