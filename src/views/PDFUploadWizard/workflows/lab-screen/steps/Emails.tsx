'use client'

import { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { getLabScreenFormOpts } from '../shared-form'
import { useLabScreenEmailPreview } from '../../components/emails/useLabScreenEmailPreview'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'
import type { SubstanceValue } from '@/fields/substanceOptions'

export const EmailsStep = withForm({
  ...getLabScreenFormOpts('emails'),

  render: function Render({ form }) {
    const [showReferralPreview, setShowReferralPreview] = useState(false)

    // Get typed form values
    const formValues = useStore(form.store, (state) => state.values)

    // Use lab screen email preview hook
    // Note: medications and breathalyzer info are automatically fetched from the matched test
    const { data: previewData, isLoading, error } = useLabScreenEmailPreview({
      testId: formValues?.matchCollection?.testId,
      testType: formValues?.labScreenData?.testType,
      detectedSubstances: (formValues?.labScreenData?.detectedSubstances || []) as SubstanceValue[],
      isDilute: formValues?.labScreenData?.isDilute || false,
    })

    // Initialize form fields when preview data loads
    useEffect(() => {
      if (previewData) {
        // Initialize client email if available
        if (previewData.clientEmail) {
          form.setFieldValue('emails.clientEmailEnabled', false) // Lab screens default to false
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
        previewData={previewData || null}
        isLoading={isLoading}
        error={error?.message || null}
        showPreview={showReferralPreview}
        setShowPreview={setShowReferralPreview}
        showClientEmail={false} // Lab tests don't show client email section
        title="Review Screening Notification Emails"
        description="Configure email recipients for lab screening results"
      />
    )
  },
})

