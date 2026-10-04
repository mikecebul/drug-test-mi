'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { getInstantTestFormOpts } from '../shared-form'
import { useInstantTestEmailPreview } from '../../components/emails/useInstantTestEmailPreview'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { ClientDetailsCard } from '../../components/client/ClientDetailsCard'
import { CollectionResultStrip } from '../../../components/CollectionResultStrip'
import { ReportLink } from '../../../components/ReportLink'
import { useComputeTestResultPreviewQuery } from '../../../queries'
import { EmailsFieldGroup } from '../../components/emails/EmailsFieldGroup'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { invalidateWizardClientDerivedData } from '../../../queries'

export const EmailsStep = withForm({
  ...getInstantTestFormOpts(),

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

    // Keep client recipients initialized and referral recipients synced to the current referral profile.
    useEffect(() => {
      if (!previewData) {
        return
      }

      const clientId = formValues?.client?.id || null
      const nextClientRecipients = previewData.clientEmail ? [previewData.clientEmail] : []
      const shouldDisableSelfReferralByDefault =
        previewData.referralType === 'self' && previewData.hasExplicitReferralRecipients === false
      const nextReferralRecipients = shouldDisableSelfReferralByDefault ? [] : previewData.referralEmails
      const previewHash = JSON.stringify({
        clientEmail: previewData.clientEmail || '',
        referralEmails: nextReferralRecipients,
        hasExplicitReferralRecipients: previewData.hasExplicitReferralRecipients,
      })
      const clientChanged = lastClientIdRef.current !== clientId
      const previewChanged = lastPreviewHashRef.current !== previewHash
      const clientRecipientsEmpty = formValues.emails.clientRecipients.length === 0

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

        form.setFieldValue('emails.referralRecipients', nextReferralRecipients)
        if (formValues.emails.referralEmailEnabled && nextReferralRecipients.length === 0) {
          form.setFieldValue('emails.referralEmailEnabled', false)
        }
      }

      lastClientIdRef.current = clientId
      lastPreviewHashRef.current = previewHash
    }, [
      previewData,
      formValues.client?.id,
      formValues.emails.clientRecipients.length,
      formValues.emails.referralEmailEnabled,
      form,
    ])

    const handleReferralProfileSaved = useCallback(async () => {
      invalidateWizardClientDerivedData(queryClient, { clientId: formValues?.client?.id || null })
      await refetch()
    }, [formValues?.client?.id, queryClient, refetch])

    const resultPreview = useComputeTestResultPreviewQuery(
      formValues.client.id,
      formValues.verifyData.detectedSubstances as SubstanceValue[],
      formValues.verifyData.testType,
      formValues.verifyData.breathalyzerTaken,
      formValues.verifyData.breathalyzerResult,
      formValues.medications,
    )
    return (
      <div className="flex flex-col gap-6">
        <ClientDetailsCard
          compact
          client={formValues.client}
          editable
          onClientUpdated={(updated) => {
            if (updated.firstName !== undefined) form.setFieldValue('client.firstName', updated.firstName)
            if (updated.middleInitial !== undefined) form.setFieldValue('client.middleInitial', updated.middleInitial)
            if (updated.lastName !== undefined) form.setFieldValue('client.lastName', updated.lastName)
            if (updated.email !== undefined) form.setFieldValue('client.email', updated.email)
            if (updated.dob !== undefined) form.setFieldValue('client.dob', updated.dob)
            if (updated.phone !== undefined) form.setFieldValue('client.phone', updated.phone)
            if (updated.gender !== undefined) form.setFieldValue('client.gender', updated.gender)
            if (updated.headshot !== undefined) form.setFieldValue('client.headshot', updated.headshot)
            if (updated.headshotId !== undefined) form.setFieldValue('client.headshotId', updated.headshotId)
            if (updated.referralType !== undefined) form.setFieldValue('client.referralType', updated.referralType)
            if (updated.referralTitle !== undefined) form.setFieldValue('client.referralTitle', updated.referralTitle)
          }}
        />
        <FieldGroupHeader title="Review result & recipients" />
        <CollectionResultStrip
          preview={resultPreview.data}
          detected={formValues.verifyData.detectedSubstances}
          isLoading={resultPreview.isFetching}
          error={resultPreview.isError}
          isDilute={formValues.verifyData.isDilute}
          breathalyzerTaken={formValues.verifyData.breathalyzerTaken}
          breathalyzerResult={formValues.verifyData.breathalyzerResult}
          finalPending={
            formValues.verifyData.confirmationDecision === 'request-confirmation' ||
            formValues.verifyData.confirmationDecision === 'pending-decision'
          }
        />
        <ReportLink file={formValues.upload.file} filename />
        <EmailsFieldGroup
          hideHeader
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
      </div>
    )
  },
})
