'use client'

import React, { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Eye, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { RecipientEditor } from '../../../components/RecipientEditor'
import { EmailPreviewModal } from '../../../components/EmailPreviewModal'
import { useGetCollectionEmailPreviewQuery } from '../../../queries'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { wizardContainerStyles } from '../../../styles'
import { cn } from '@/utilities/cn'
import { collectLabFormOpts } from '../shared-form'

export const EmailsGroup = withForm({
  ...collectLabFormOpts,
  props: {
    title: 'Review Collection Notification',
    description: '',
  },

  render: function Render({ form, title, description }) {
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
          <FieldGroupHeader title={title} description={description} />
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
          <FieldGroupHeader title={title} description={description} />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Failed to load email preview'}</AlertDescription>
          </Alert>
        </div>
      )
    }

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title={title} description={description} />
        <div className={cn(wizardContainerStyles.fields, 'text-base md:text-lg')}>
          {/* Referral Email Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Referral Notification</CardTitle>
                  <CardDescription>
                    Notify referrals that specimen has been collected
                  </CardDescription>
                </div>
                <form.Field name="emails.referralEmailEnabled">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="referral-enabled"
                        checked={field.state.value}
                        onCheckedChange={(checked) => field.handleChange(checked === true)}
                      />
                      <Label htmlFor="referral-enabled" className="cursor-pointer font-normal">
                        Send referral notifications
                      </Label>
                    </div>
                  )}
                </form.Field>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {emails.referralEmailEnabled && (
                <>
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
                          <p className="text-destructive text-sm">
                            {field.state.meta.errors[0]?.message}
                          </p>
                        )}
                      </>
                    )}
                  </form.Field>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReferralPreview(true)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Notification Email
                  </Button>
                </>
              )}

              {!emails.referralEmailEnabled && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Referrals will not be notified about this specimen collection.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>Ready to send:</strong>{' '}
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
