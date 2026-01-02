'use client'

import { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { getLabConfirmationFormOpts } from '../shared-form'
import { useLabConfirmationEmailPreview } from '../../components/emails/useLabConfirmationEmailPreview'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'
import type { SubstanceValue } from '@/fields/substanceOptions'

export const EmailsStep = withForm({
  ...getLabConfirmationFormOpts('emails'),

  render: function Render({ form }) {
    const [showReferralPreview, setShowReferralPreview] = useState(false)

    // Get typed form values
    const formValues = useStore(form.store, (state) => state.values)

    // Use lab confirmation email preview hook
    const { data: previewData, isLoading, error } = useLabConfirmationEmailPreview({
      testId: formValues?.matchCollection?.testId,
      confirmationResults: formValues?.labConfirmationData?.confirmationResults?.map((r) => ({
        ...r,
        substance: r.substance as SubstanceValue,
      })),
      originalDetectedSubstances: (formValues?.labConfirmationData?.originalDetectedSubstances || []) as SubstanceValue[],
    })

    // Initialize form fields when preview data loads
    useEffect(() => {
      if (previewData) {
        // Initialize client email if available and not yet set
        if (previewData.clientEmail && formValues.emails.clientRecipients.length === 0) {
          form.setFieldValue('emails.clientEmailEnabled', true)
          form.setFieldValue('emails.clientRecipients', [previewData.clientEmail])
        }
        // Initialize referral emails if not yet set
        if (previewData.referralEmails.length > 0 && formValues.emails.referralRecipients.length === 0) {
          form.setFieldValue('emails.referralEmailEnabled', true)
          form.setFieldValue('emails.referralRecipients', previewData.referralEmails)
        }
      }
    }, [previewData, formValues.emails.clientRecipients.length, formValues.emails.referralRecipients.length, form])

    return (
      <EmailsFieldGroup
        form={form}
        fields="emails"
        previewData={previewData || null}
        isLoading={isLoading}
        error={error?.message || null}
        showPreview={showReferralPreview}
        setShowPreview={setShowReferralPreview}
        showClientEmail={true} // Confirmation results go to clients
        title="Review Confirmation Notification Emails"
        description="Configure email recipients for final lab-confirmed test results"
      />
    )
  },
})
