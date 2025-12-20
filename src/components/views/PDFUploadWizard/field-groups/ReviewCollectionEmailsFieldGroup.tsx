'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Eye, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { RecipientEditor } from '../components/RecipientEditor'
import { EmailPreviewModal } from '../components/EmailPreviewModal'
import { z } from 'zod'
import { useGetCollectionEmailPreviewQuery } from '../queries'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { wizardContainerStyles } from '../styles'
import { cn } from '@/utilities/cn'

type EmailPreviewData = {
  referralEmails: string[]
  referralHtml: string
  referralSubject: string
}

// Export the schema for reuse in step validation
export const reviewCollectionEmailsFieldSchema = z.object({
  clientEmailEnabled: z.boolean(),
  clientRecipients: z.array(z.string().email()),
  referralEmailEnabled: z.boolean(),
  referralRecipients: z.array(z.string().email()),
  previewsLoaded: z.boolean(),
}).refine((data) => {
  // For collection, only referral emails are relevant
  // If referral email enabled, must have at least one recipient
  if (data.referralEmailEnabled && data.referralRecipients.length === 0) {
    return false
  }
  return true
}, {
  message: 'Referral emails must have at least one recipient'
})

type ReviewCollectionEmailsFields = {
  clientEmailEnabled: boolean
  clientRecipients: string[]
  referralEmailEnabled: boolean
  referralRecipients: string[]
  previewsLoaded: boolean
}

const defaultValues: ReviewCollectionEmailsFields = {
  clientEmailEnabled: false,
  clientRecipients: [],
  referralEmailEnabled: true,
  referralRecipients: [],
  previewsLoaded: false,
}

export const ReviewCollectionEmailsFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Review Collection Notification',
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    const [showReferralPreview, setShowReferralPreview] = useState(false)

    // Get data from previous steps
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const clientData = formValues.clientData
    const collectionDetails = formValues.collectionDetails

    // Fetch email preview using TanStack Query
    const emailPreviewQuery = useGetCollectionEmailPreviewQuery({
      clientId: clientData?.id,
      testType: collectionDetails?.testType,
      collectionDate: collectionDetails?.collectionDate,
      collectionTime: collectionDetails?.collectionTime,
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
      if (previewData && !group.state.values.previewsLoaded) {
        group.setFieldValue('clientEmailEnabled', false) // No client emails for collection
        group.setFieldValue('clientRecipients', [])
        group.setFieldValue('referralEmailEnabled', true)
        group.setFieldValue('referralRecipients', previewData.referralEmails)
        group.setFieldValue('previewsLoaded', true)
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

    const currentValues = group.state.values

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title={title} description={description} />
        <div className={cn(wizardContainerStyles.fields, "text-base md:text-lg")}>
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="referral-enabled"
                  checked={currentValues.referralEmailEnabled}
                  onCheckedChange={(checked) =>
                    group.setFieldValue('referralEmailEnabled', checked === true)
                  }
                />
                <Label htmlFor="referral-enabled" className="cursor-pointer font-normal">
                  Send referral notifications
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentValues.referralEmailEnabled && (
              <>
                <RecipientEditor
                  initialRecipients={previewData.referralEmails}
                  onChange={(recipients) => group.setFieldValue('referralRecipients', recipients)}
                  label="Recipient Email Addresses"
                  required={true}
                  maxRecipients={10}
                />

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

            {!currentValues.referralEmailEnabled && (
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
            {currentValues.referralEmailEnabled && currentValues.referralRecipients.length > 0 ? (
              <span>
                {currentValues.referralRecipients.length} referral notification
                {currentValues.referralRecipients.length !== 1 ? 's' : ''}
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
            recipients={currentValues.referralRecipients}
            emailType="referral"
          />
        )}
        </div>
      </div>
    )
  },
})
