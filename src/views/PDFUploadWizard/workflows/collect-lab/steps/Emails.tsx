'use client'

import { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { getCollectLabFormOpts } from '../shared-form'
import { useEmailPreview } from '../../components/emails/useEmailPreview'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'

export const EmailsStep = withForm({
  ...getCollectLabFormOpts('reviewEmails'),

  render: function Render({ form }) {
    const [showReferralPreview, setShowReferralPreview] = useState(false)

    // Get typed form values
    const formValues = useStore(form.store, (state) => state.values)

    // Use email preview hook
    const { previewData, isLoading, error } = useEmailPreview({
      clientId: formValues?.client?.id,
      testType: formValues?.collection?.testType,
      collectionDate: formValues?.collection?.collectionDate,
      breathalyzerTaken: formValues?.collection?.breathalyzerTaken,
      breathalyzerResult: formValues?.collection?.breathalyzerResult,
    })

    // Initialize form fields when preview data loads
    useEffect(() => {
      if (previewData && previewData.referralEmails.length > 0 && formValues.emails.referralRecipients.length === 0) {
        form.setFieldValue('emails.referralEmailEnabled', true)
        form.setFieldValue('emails.referralRecipients', previewData.referralEmails)
      }
    }, [previewData, formValues.emails.referralRecipients.length, form])

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
      />
    )
  },
})
