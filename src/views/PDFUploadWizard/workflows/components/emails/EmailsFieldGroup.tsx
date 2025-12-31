'use client'

import React from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Eye, AlertCircle, CheckCircle2 } from 'lucide-react'
import { RecipientEditor } from '../../../components/RecipientEditor'
import { EmailPreviewModal } from './EmailPreviewModal'
import { FieldGroupHeader } from '../FieldGroupHeader'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field'

interface EmailPreviewData {
  clientEmail?: string
  clientHtml?: string
  clientSubject?: string
  referralEmails: string[]
  referralTitle: string // Organization name (employer, court, etc.)
  referralHtml: string
  referralSubject: string
}

const defaultValues: {
  clientEmailEnabled: boolean
  clientRecipients: string[]
  referralEmailEnabled: boolean
  referralRecipients: string[]
} = {
  clientEmailEnabled: false,
  clientRecipients: [],
  referralEmailEnabled: false,
  referralRecipients: [],
}

export const EmailsFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Review Collection Notification',
    description: 'Configure email notifications for this collection',
    previewData: null as EmailPreviewData | null,
    isLoading: false,
    error: null as string | null,
    showPreview: false,
    setShowPreview: (() => {}) as (show: boolean) => void,
    showClientEmail: false, // Show client email section (for instant tests)
  },

  render: function Render({ group, title, description, previewData, isLoading, error, showPreview, setShowPreview, showClientEmail }) {
    const [showClientPreview, setShowClientPreview] = React.useState(false)

    // Get current field group values
    const clientEmailEnabled = group.getFieldValue('clientEmailEnabled')
    const clientRecipients = group.getFieldValue('clientRecipients')
    const referralEmailEnabled = group.getFieldValue('referralEmailEnabled')
    const referralRecipients = group.getFieldValue('referralRecipients')

    if (isLoading) {
      return (
        <div className="space-y-6">
          <FieldGroupHeader title={title} description={description} />
          <Card>
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">Loading email preview...</p>
              </div>
            </div>
          </Card>
        </div>
      )
    }

    if (error || !previewData) {
      return (
        <div className="space-y-6">
          <FieldGroupHeader title={title} description={description} />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Failed to load email preview'}</AlertDescription>
          </Alert>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <FieldGroupHeader title={title} description={description} />
        <div className="space-y-6 text-base md:text-lg">
          {/* Client Email Section */}
          {showClientEmail && previewData?.clientEmail && (
            <Card className="p-6">
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Client Notification</FieldLegend>
                  <FieldDescription>Notify client of their test results</FieldDescription>
                  <FieldGroup data-slot="checkbox-group">
                    <group.Field name="clientEmailEnabled">
                      {(field) => (
                        <Field orientation="horizontal" data-invalid={field.state.meta.errors.length > 0}>
                          <Checkbox
                            id="client-enabled"
                            checked={field.state.value}
                            onCheckedChange={(checked) => field.handleChange(checked === true)}
                          />
                          <FieldLabel htmlFor="client-enabled">Send client notification</FieldLabel>
                        </Field>
                      )}
                    </group.Field>
                  </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                {clientEmailEnabled && (
                  <FieldSet>
                    <group.Field name="clientRecipients">
                      {(field) => (
                        <>
                          <RecipientEditor
                            initialRecipients={previewData.clientEmail ? [previewData.clientEmail] : []}
                            onChange={(recipients) => field.handleChange(recipients)}
                            label="Client Email Address"
                            required={true}
                            maxRecipients={1}
                          />
                          {field.state.meta.errors.length > 0 && (
                            <FieldError>
                              {String((field.state.meta.errors[0] as any)?.message || 'Invalid value')}
                            </FieldError>
                          )}
                        </>
                      )}
                    </group.Field>

                    <Button type="button" variant="outline" size="sm" onClick={() => setShowClientPreview(true)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Client Email
                    </Button>
                  </FieldSet>
                )}
              </FieldGroup>
            </Card>
          )}

          {/* Referral Email Section */}
          <Card className="p-6">
            <FieldGroup>
              <FieldSet>
                <FieldLegend>
                  Referral Notification
                  {previewData.referralTitle && (
                    <span className="text-muted-foreground ml-2 font-normal">({previewData.referralTitle})</span>
                  )}
                </FieldLegend>
                <FieldDescription>Notify referrals that specimen has been collected</FieldDescription>
                <FieldGroup data-slot="checkbox-group">
                  <group.Field name="referralEmailEnabled">
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
                  </group.Field>
                </FieldGroup>
              </FieldSet>
              <FieldSeparator />
              {referralEmailEnabled && (
                <FieldSet>
                  <group.Field name="referralRecipients">
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
                          <FieldError>
                            {String((field.state.meta.errors[0] as any)?.message || 'Invalid value')}
                          </FieldError>
                        )}
                      </>
                    )}
                  </group.Field>

                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(true)}>
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
              {(() => {
                const clientCount = clientEmailEnabled && clientRecipients && clientRecipients.length > 0 ? clientRecipients.length : 0
                const referralCount = referralEmailEnabled && referralRecipients && referralRecipients.length > 0 ? referralRecipients.length : 0
                const totalCount = clientCount + referralCount

                if (totalCount === 0) {
                  return <span className="text-destructive">No notifications will be sent</span>
                }

                const parts: string[] = []
                if (clientCount > 0) {
                  parts.push(`${clientCount} client notification${clientCount !== 1 ? 's' : ''}`)
                }
                if (referralCount > 0) {
                  parts.push(`${referralCount} referral notification${referralCount !== 1 ? 's' : ''}`)
                }

                return <span>{parts.join(' and ')}</span>
              })()}
            </AlertDescription>
          </Alert>

          {/* Email Preview Modals */}
          {showClientPreview && previewData?.clientHtml && (
            <EmailPreviewModal
              isOpen={showClientPreview}
              onClose={() => setShowClientPreview(false)}
              emailHtml={previewData.clientHtml}
              subject={previewData.clientSubject || 'Client Notification'}
              recipients={clientRecipients || []}
              emailType="client"
            />
          )}
          {showPreview && (
            <EmailPreviewModal
              isOpen={showPreview}
              onClose={() => setShowPreview(false)}
              emailHtml={previewData.referralHtml}
              subject={previewData.referralSubject}
              recipients={referralRecipients || []}
              emailType="referral"
            />
          )}
        </div>
      </div>
    )
  },
})
