'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { getLabScreenFormOpts } from '../shared-form'
import { useLabScreenEmailPreview } from '../../components/emails/useLabScreenEmailPreview'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { invalidateWizardClientDerivedData, useGetClientFromTestQuery } from '../../../queries'

export const EmailsStep = withForm({
  ...getLabScreenFormOpts('emails'),

  render: function Render({ form }) {
    const queryClient = useQueryClient()
    const [showReferralPreview, setShowReferralPreview] = useState(false)
    const lastClientIdRef = useRef<string | null>(null)
    const lastPreviewHashRef = useRef<string>('')

    // Get typed form values
    const formValues = useStore(form.store, (state) => state.values)
    const { data: client } = useGetClientFromTestQuery(formValues?.matchCollection?.testId)

    // Use lab screen email preview hook
    // Note: medications and breathalyzer info are automatically fetched from the matched test
    const {
      data: previewData,
      isLoading,
      error,
    } = useLabScreenEmailPreview({
      testId: formValues?.matchCollection?.testId,
      testType: formValues?.labScreenData?.testType,
      detectedSubstances: (formValues?.labScreenData?.detectedSubstances || []) as SubstanceValue[],
      isDilute: formValues?.labScreenData?.isDilute || false,
    })

    // Initialize and sync recipients without clobbering manual edits.
    useEffect(() => {
      if (!previewData) {
        return
      }

      const clientId = client?.id || null
      const nextClientRecipients = previewData.clientEmail ? [previewData.clientEmail] : []
      const nextReferralRecipients = previewData.referralEmails
      const previewHash = JSON.stringify({
        clientEmail: previewData.clientEmail || '',
        referralEmails: nextReferralRecipients,
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
      client?.id,
      previewData,
      formValues.emails.clientRecipients.length,
      formValues.emails.referralRecipients.length,
      form,
    ])

    const handleReferralProfileSaved = useCallback(() => {
      invalidateWizardClientDerivedData(queryClient, {
        clientId: client?.id || null,
        testId: formValues?.matchCollection?.testId || null,
      })
    }, [client?.id, formValues?.matchCollection?.testId, queryClient])

    return (
      <EmailsFieldGroup
        form={form}
        fields="emails"
        previewData={previewData || null}
        isLoading={isLoading}
        error={error?.message || null}
        showPreview={showReferralPreview}
        setShowPreview={setShowReferralPreview}
        showClientEmail={true}
        title="Review Screening Notification Emails"
        description="Configure email recipients for lab screening results"
        clientId={client?.id || null}
        onReferralProfileSaved={handleReferralProfileSaved}
      />
    )
  },
})
