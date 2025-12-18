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
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import {
  useGetEmailPreviewQuery,
  useGetConfirmationEmailPreviewQuery,
  useGetClientFromTestQuery,
} from '../queries'

type WorkflowMode = 'screening' | 'confirmation'

type EmailPreviewData = {
  clientEmail: string
  referralEmails: string[]
  clientHtml: string
  referralHtml: string
  smartGrouping: 'separate' | 'combined'
  clientSubject: string
  referralSubject: string
}

// Export the schema for reuse in step validation
export const reviewEmailsFieldSchema = z.object({
  clientEmailEnabled: z.boolean(),
  clientRecipients: z.array(z.string().email()),
  referralEmailEnabled: z.boolean(),
  referralRecipients: z.array(z.string().email()),
  previewsLoaded: z.boolean(),
}).refine((data) => {
  // At least one email type must be enabled
  return data.clientEmailEnabled || data.referralEmailEnabled
}, {
  message: 'At least one email type must be enabled'
}).refine((data) => {
  // If client email enabled, must have at least one recipient
  if (data.clientEmailEnabled && data.clientRecipients.length === 0) {
    return false
  }
  // If referral email enabled, must have at least one recipient
  if (data.referralEmailEnabled && data.referralRecipients.length === 0) {
    return false
  }
  return true
}, {
  message: 'Enabled email types must have at least one recipient'
})

const defaultValues: PdfUploadFormType['reviewEmailsData'] = {
  clientEmailEnabled: false,
  clientRecipients: [],
  referralEmailEnabled: true,
  referralRecipients: [],
  previewsLoaded: false,
}

export const ReviewEmailsFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Review Emails',
    description: '',
    workflowMode: 'screening' as WorkflowMode,
  },

  render: function Render({ group, title, description = '', workflowMode }) {
    const [showClientPreview, setShowClientPreview] = useState(false)
    const [showReferralPreview, setShowReferralPreview] = useState(false)

    // Get data from previous steps
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const verifyData = formValues.verifyData
    const verifyConfirmation = formValues.verifyConfirmation
    const verifyTest = formValues.verifyTest

    // For lab workflows, fetch client data from the matched test
    const clientFromTestQuery = useGetClientFromTestQuery(verifyTest?.testId)

    // Client can come from:
    // 1. clientData (instant test workflow - selected in VerifyClientFieldGroup)
    // 2. clientFromTestQuery.data (lab workflows - fetched from matched test)
    const clientData = formValues.clientData || clientFromTestQuery.data

    // Get medications from form state (updated in VerifyMedicationsFieldGroup)
    const allMedications = formValues.medicationsData?.medications ?? []

    // Calculate adjusted substances for confirmation workflow
    // Remove substances that were confirmed negative from the detected substances list
    const adjustedSubstances = React.useMemo(() => {
      if (workflowMode !== 'confirmation' || !verifyConfirmation?.confirmationResults) {
        return undefined
      }

      const originalDetectedSubstances = verifyConfirmation.detectedSubstances || []
      const confirmationResults = verifyConfirmation.confirmationResults || []

      return originalDetectedSubstances.filter((substance: string) => {
        const confirmationResult = confirmationResults.find(
          (r: any) => r.substance.toLowerCase() === substance.toLowerCase(),
        )
        return !(confirmationResult && confirmationResult.result === 'confirmed-negative')
      })
    }, [workflowMode, verifyConfirmation])

    // Fetch email preview based on workflow mode using TanStack Query
    const screeningEmailQuery = useGetEmailPreviewQuery({
      clientId: workflowMode === 'screening' ? clientData?.id : null,
      detectedSubstances: verifyData?.detectedSubstances ?? [],
      testType: verifyData?.testType,
      collectionDate: verifyData?.collectionDate,
      isDilute: verifyData?.isDilute ?? false,
      breathalyzerTaken: verifyData?.breathalyzerTaken ?? false,
      breathalyzerResult: verifyData?.breathalyzerResult ?? null,
      confirmationDecision: verifyData?.confirmationDecision,
      medications: allMedications, // Pass all medications (computeTestResults filters to active)
    })

    const confirmationEmailQuery = useGetConfirmationEmailPreviewQuery({
      clientId: workflowMode === 'confirmation' ? clientData?.id : null,
      testId: verifyTest?.testId,
      confirmationResults: verifyConfirmation?.confirmationResults ?? [],
      adjustedSubstances,
    })

    // Select the appropriate query based on workflow mode
    const activeQuery = workflowMode === 'confirmation' ? confirmationEmailQuery : screeningEmailQuery
    const previewData = activeQuery.data?.data ?? null
    const isLoading = activeQuery.isLoading
    const queryError = activeQuery.error

    // Determine error message
    const error = queryError
      ? queryError instanceof Error
        ? queryError.message
        : 'Failed to load email preview'
      : !clientData?.id
        ? 'Missing client data'
        : workflowMode === 'confirmation' && (!verifyTest?.testId || !verifyConfirmation?.confirmationResults)
          ? 'Missing test or confirmation data'
          : workflowMode === 'screening' && !verifyData
            ? 'Missing screening data'
            : null

    // Initialize form fields when preview data loads
    useEffect(() => {
      if (previewData && !group.state.values.previewsLoaded) {
        group.setFieldValue('clientEmailEnabled', previewData.smartGrouping === 'separate')
        group.setFieldValue(
          'clientRecipients',
          previewData.smartGrouping === 'separate' ? [previewData.clientEmail] : [],
        )
        group.setFieldValue('referralEmailEnabled', true)
        group.setFieldValue('referralRecipients', previewData.referralEmails)
        group.setFieldValue('previewsLoaded', true)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewData])

    if (isLoading) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
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
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Failed to load email preview'}</AlertDescription>
          </Alert>
        </div>
      )
    }

    const { smartGrouping } = previewData
    const currentValues = group.state.values

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {/* Client Email Section (for probation/employment only) */}
        {smartGrouping === 'separate' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Client Email</CardTitle>
                  <CardDescription>
                    Email sent to {clientData.firstName} {clientData.lastName}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="client-enabled"
                    checked={currentValues.clientEmailEnabled}
                    onCheckedChange={(checked) =>
                      group.setFieldValue('clientEmailEnabled', checked === true)
                    }
                  />
                  <Label htmlFor="client-enabled" className="cursor-pointer font-normal">
                    Send client email
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentValues.clientEmailEnabled && (
                <>
                  <RecipientEditor
                    initialRecipients={previewData.clientEmail ? [previewData.clientEmail] : []}
                    onChange={(recipients) => group.setFieldValue('clientRecipients', recipients)}
                    label="Client Email Address"
                    required={true}
                    maxRecipients={1}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClientPreview(true)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Client Email
                  </Button>
                </>
              )}

              {!currentValues.clientEmailEnabled && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Client will not receive an email notification for this test.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Referral Email Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {smartGrouping === 'combined' ? 'Your Email' : 'Referral Emails'}
                </CardTitle>
                <CardDescription>
                  {smartGrouping === 'combined'
                    ? 'Email sent to the client (self-pay)'
                    : 'Emails sent to court officers, probation officers, or employers'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="referral-enabled"
                  checked={currentValues.referralEmailEnabled}
                  onCheckedChange={(checked) =>
                    group.setFieldValue('referralEmailEnabled', checked === true)
                  }
                  disabled={smartGrouping === 'combined'} // Can't disable for self-pay
                />
                <Label htmlFor="referral-enabled" className="cursor-pointer font-normal">
                  Send {smartGrouping === 'combined' ? 'email' : 'referral emails'}
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
                  required={smartGrouping === 'combined'} // Always required for self-pay
                  maxRecipients={10}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReferralPreview(true)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview {smartGrouping === 'combined' ? 'Email' : 'Referral Email'}
                </Button>
              </>
            )}

            {!currentValues.referralEmailEnabled && smartGrouping !== 'combined' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Referrals will not receive email notifications for this test. This is not
                  recommended for{' '}
                  {clientData.clientType === 'probation' ? 'probation' : 'employment'} clients.
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
            {currentValues.clientEmailEnabled && currentValues.clientRecipients.length > 0 && (
              <span>
                {currentValues.clientRecipients.length} client email
                {currentValues.referralEmailEnabled &&
                  currentValues.referralRecipients.length > 0 &&
                  ', '}
              </span>
            )}
            {currentValues.referralEmailEnabled && currentValues.referralRecipients.length > 0 && (
              <span>
                {currentValues.referralRecipients.length} referral email
                {currentValues.referralRecipients.length !== 1 ? 's' : ''}
              </span>
            )}
            {!currentValues.clientEmailEnabled && !currentValues.referralEmailEnabled && (
              <span className="text-destructive">No emails will be sent</span>
            )}
          </AlertDescription>
        </Alert>

        {/* Email Preview Modals */}
        {showClientPreview && smartGrouping === 'separate' && (
          <EmailPreviewModal
            isOpen={showClientPreview}
            onClose={() => setShowClientPreview(false)}
            emailHtml={previewData.clientHtml}
            subject={previewData.clientSubject}
            recipients={currentValues.clientRecipients}
            emailType="client"
          />
        )}

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
    )
  },
})
