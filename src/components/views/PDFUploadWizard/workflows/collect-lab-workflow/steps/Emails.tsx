'use client'

import React, { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Eye, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { RecipientEditor } from '../../../components/RecipientEditor'
import { EmailPreviewModal } from '../../../components/EmailPreviewModal'
import { useGetCollectionEmailPreviewQuery } from '../../../queries'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { wizardContainerStyles } from '../../../styles'
import { cn } from '@/utilities/cn'
import { collectLabFormOpts } from '../shared-form'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field'

export const EmailsStep = withForm({
  ...collectLabFormOpts,

  render: function Render({ form }) {
    const [showReferralPreview, setShowReferralPreview] = useState(false)

    // Get data from previous steps
    const [clientData, collectionDetails, emails] = useStore(form.store, (state) => [
      state.values.client,
      state.values.collection,
      state.values.emails,
    ])

    // Fetch email preview using TanStack Query
    const emailPreviewQuery = useGetCollectionEmailPreviewQuery({
      clientId: clientData?.id,
      testType: collectionDetails?.testType,
      collectionDate: collectionDetails?.collectionDate,
      breathalyzerTaken: collectionDetails?.breathalyzerTaken,
      breathalyzerResult: collectionDetails?.breathalyzerResult,
    })

    const previewData = emailPreviewQuery.data?.data ?? null
    const isLoading = emailPreviewQuery.isLoading
    const error = emailPreviewQuery.error
      ? emailPreviewQuery.error instanceof Error
        ? emailPreviewQuery.error.message
        : 'Failed to load email preview'
      : !clientData?.id || !collectionDetails
        ? 'Missing client or collection data'
        : null

    // Initialize form fields when preview data loads
    useEffect(() => {
      if (previewData) {
        form.setFieldValue('emails.referralEmailEnabled', true)
        form.setFieldValue('emails.referralRecipients', previewData.referralEmails)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewData])

    if (isLoading) {
      return (
        <div className={wizardContainerStyles.content}>
          <FieldGroupHeader title="Review Collection Notification" />
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">Loading email preview...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    if (error || !previewData) {
      return (
        <div className={wizardContainerStyles.content}>
          <FieldGroupHeader title="Review Collection Notification" />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Failed to load email preview'}</AlertDescription>
          </Alert>
        </div>
      )
    }

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title="Review Collection Notification" />
        <div className={cn(wizardContainerStyles.fields, 'text-base md:text-lg')}>
          {/* Referral Email Section */}
          <Card className="p-6">
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Referral Notification</FieldLegend>
                <FieldDescription>Notify referrals that specimen has been collected</FieldDescription>
                <FieldGroup data-slot="checkbox-group">
                  <form.Field name="emails.referralEmailEnabled">
                    {(field) => (
                      <Field orientation="horizontal" data-invalid={field.state.meta.errors.length > 0}>
                        <Checkbox
                          id="referral-enabled"
                          checked={field.state.value}
                          onCheckedChange={(checked) => field.handleChange(checked === true)}
                        />
                        <FieldLabel htmlFor="referral-enabled">Send referral notifications</FieldLabel>
                      </Field>
                    )}
                  </form.Field>
                </FieldGroup>
              </FieldSet>
              <FieldSeparator />
              {emails.referralEmailEnabled && (
                <FieldSet>
                  <form.Field name="emails.referralRecipients">
                    {(field) => (
                      <>
                        <RecipientEditor
                          initialRecipients={previewData.referralEmails}
                          onChange={(recipients) => field.handleChange(recipients)}
                          label="Recipient Email Addresses"
                          required={true}
                          maxRecipients={10}
                        />
                        {field.state.meta.errors.length > 0 && (
                          <p className="text-destructive text-sm">{field.state.meta.errors[0]?.message}</p>
                        )}
                      </>
                    )}
                  </form.Field>

                  <Button type="button" variant="outline" size="sm" onClick={() => setShowReferralPreview(true)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Notification Email
                  </Button>
                </FieldSet>
              )}
            </FieldGroup>
          </Card>

          {/* Summary */}
          <Alert>
            <CheckCircle2 className="size-5" />
            <AlertTitle>Ready to send</AlertTitle>
            <AlertDescription>
              {emails.referralEmailEnabled && emails.referralRecipients.length > 0 ? (
                <span>
                  {emails.referralRecipients.length} referral notification
                  {emails.referralRecipients.length !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-destructive">No notifications will be sent</span>
              )}
            </AlertDescription>
          </Alert>

          {/* Email Preview Modal */}
          {showReferralPreview && (
            <EmailPreviewModal
              isOpen={showReferralPreview}
              onClose={() => setShowReferralPreview(false)}
              emailHtml={previewData.referralHtml}
              subject={previewData.referralSubject}
              recipients={emails.referralRecipients}
              emailType="referral"
            />
          )}
        </div>
      </div>
    )
  },
})
