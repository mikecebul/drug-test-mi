'use client'

import React from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Eye, AlertCircle, CheckCircle2, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RecipientEditor } from '../../../components/RecipientEditor'
import { EmailPreviewModal } from './EmailPreviewModal'
import { FieldGroupHeader } from '../FieldGroupHeader'
import { invalidateWizardClientDerivedData } from '../../../queries'
import { ReferralProfileDialog } from './referrals/ReferralProfileDialog'
import { ClientEmailDialog } from './client/ClientEmailDialog'
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

type RecipientDetail = {
  name: string
  email: string
}

interface EmailPreviewData {
  clientEmail?: string
  clientHtml?: string
  clientSubject?: string
  referralType?: 'court' | 'employer' | 'self'
  referralEmails: string[]
  referralPresetId?: string
  hasExplicitReferralRecipients?: boolean
  referralRecipientsDetailed?: RecipientDetail[]
  clientAdditionalRecipientsDetailed?: RecipientDetail[]
  referralTitle: string // Organization name (employer, court, etc.)
  referralHtml: string
  referralSubject: string
}

type GroupFormBridge = {
  setFieldValue?: (name: string, value: unknown) => void
  form?: {
    setFieldValue?: (name: string, value: unknown) => void
    validate?: (cause: 'submit') => unknown
  }
  name?: string
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
    clientId: null as string | null,
    onReferralProfileSaved: (() => {}) as (data: {
      referralTitle: string
      referralEmails: string[]
      referralType: 'court' | 'employer' | 'self'
    }) => void,
    onClientEmailSaved: (() => {}) as () => void | Promise<void>,
  },

  render: function Render({
    group,
    title,
    description,
    previewData,
    isLoading,
    error,
    showPreview,
    setShowPreview,
    showClientEmail,
    clientId,
    onReferralProfileSaved,
    onClientEmailSaved,
  }) {
    const queryClient = useQueryClient()
    const [showClientPreview, setShowClientPreview] = React.useState(false)
    const [showClientEmailEditor, setShowClientEmailEditor] = React.useState(false)
    const [showReferralEditor, setShowReferralEditor] = React.useState(false)
    const [referralEditorVersion, setReferralEditorVersion] = React.useState(0)

    // Get current field group values
    const clientEmailEnabled = group.getFieldValue('clientEmailEnabled')
    const clientRecipients = group.getFieldValue('clientRecipients')
    const referralEmailEnabled = group.getFieldValue('referralEmailEnabled')
    const referralRecipients = group.getFieldValue('referralRecipients')
    const canSendClientEmail = Boolean(previewData?.clientEmail)
    const savedReferralRecipients = React.useMemo(() => {
      const detailedRecipients = [
        ...(previewData?.referralRecipientsDetailed || []),
        ...(previewData?.clientAdditionalRecipientsDetailed || []),
      ].filter((recipient) => recipient.email.trim())

      const seenEmails = new Set<string>()
      const recipients =
        detailedRecipients.length > 0
          ? detailedRecipients
          : (previewData?.referralEmails || []).map((email) => ({
              name: previewData?.referralTitle || 'Saved referral recipient',
              email,
            }))

      return recipients.filter((recipient) => {
        const emailKey = recipient.email.trim().toLowerCase()
        if (!emailKey || seenEmails.has(emailKey)) return false
        seenEmails.add(emailKey)
        return true
      })
    }, [
      previewData?.clientAdditionalRecipientsDetailed,
      previewData?.referralEmails,
      previewData?.referralRecipientsDetailed,
      previewData?.referralTitle,
    ])
    const savedReferralEmails = React.useMemo(
      () => savedReferralRecipients.map((recipient) => recipient.email),
      [savedReferralRecipients],
    )
    const savedReferralEmailSet = React.useMemo(
      () => new Set(savedReferralEmails.map((email) => email.trim().toLowerCase())),
      [savedReferralEmails],
    )
    const oneTimeRecipients = React.useMemo(
      () =>
        (referralRecipients || []).filter(
          (email) => email.trim() && !savedReferralEmailSet.has(email.trim().toLowerCase()),
        ),
      [referralRecipients, savedReferralEmailSet],
    )
    const validOneTimeRecipientCount = oneTimeRecipients.length

    const setEmailFieldValue = React.useCallback(function setEmailFieldValue(
      name: 'clientRecipients' | 'referralRecipients' | 'clientEmailEnabled' | 'referralEmailEnabled',
      value: unknown,
    ) {
      const bridge = group as unknown as GroupFormBridge

      if (typeof bridge.setFieldValue === 'function') {
        bridge.setFieldValue(name, value)
        return
      }

      if (bridge?.form && typeof bridge.form.setFieldValue === 'function' && typeof bridge.name === 'string') {
        bridge.form.setFieldValue(`${bridge.name}.${name}`, value)
      }
    }, [group])

    const validateSubmitState = React.useCallback(function validateSubmitState() {
      const bridge = group as unknown as GroupFormBridge
      if (bridge?.form && typeof bridge.form.validate === 'function') {
        void bridge.form.validate('submit')
      }
    }, [group])

    function handleReferralProfileSavedFromDialog(data: {
      referralTitle: string
      referralEmails: string[]
      referralType: 'court' | 'employer' | 'self'
      referralRecipientsDetailed: RecipientDetail[]
      clientAdditionalRecipientsDetailed: RecipientDetail[]
      referralPresetId?: string
    }) {
      setEmailFieldValue('referralEmailEnabled', data.referralEmails.length > 0)
      setEmailFieldValue('referralRecipients', data.referralEmails)
      validateSubmitState()
      setReferralEditorVersion((version) => version + 1)

      invalidateWizardClientDerivedData(queryClient, { clientId })

      onReferralProfileSaved({
        referralTitle: data.referralTitle,
        referralEmails: data.referralEmails,
        referralType: data.referralType,
      })
    }

    function handleClientEmailSavedFromDialog(data: { email: string }) {
      setEmailFieldValue('clientRecipients', [data.email])
      setEmailFieldValue('clientEmailEnabled', true)
      validateSubmitState()

      invalidateWizardClientDerivedData(queryClient, { clientId })
      void onClientEmailSaved()
    }

    React.useEffect(() => {
      if (!showClientEmail || !previewData || canSendClientEmail) {
        return
      }

      if (clientEmailEnabled) {
        setEmailFieldValue('clientEmailEnabled', false)
        validateSubmitState()
      }

      if (clientRecipients.length > 0) {
        setEmailFieldValue('clientRecipients', [])
        validateSubmitState()
      }
    }, [
      showClientEmail,
      previewData,
      canSendClientEmail,
      clientEmailEnabled,
      clientRecipients.length,
      setEmailFieldValue,
      validateSubmitState,
    ])

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
          {showClientEmail && (
            <Card className="p-6">
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Client Notification</FieldLegend>
                  <FieldDescription>
                    {canSendClientEmail
                      ? 'Notify client of their test results'
                      : 'Client email notifications are disabled for this profile'}
                  </FieldDescription>
                  <FieldGroup data-slot="checkbox-group">
                    <group.Field name="clientEmailEnabled">
                      {(field) => (
                        <Field orientation="horizontal" data-invalid={field.state.meta.errors.length > 0}>
                          <Checkbox
                            id="client-enabled"
                            checked={field.state.value}
                            onCheckedChange={(checked) => {
                              field.handleChange(checked === true)
                              validateSubmitState()
                            }}
                            disabled={!canSendClientEmail}
                          />
                          <FieldLabel htmlFor="client-enabled">
                            {canSendClientEmail
                              ? 'Send client notification'
                              : 'Client notification disabled'}
                          </FieldLabel>
                        </Field>
                      )}
                    </group.Field>
                  </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                {clientEmailEnabled && canSendClientEmail && (
                  <FieldSet>
                    <group.Field name="clientRecipients">
                      {(field) => (
                        <div className="space-y-4 max-w-2xl">
                          <div className="flex items-center justify-between gap-4">
                            <FieldLabel className="text-base font-semibold">
                              Client Email Address
                              <span className="ml-1 text-destructive">*</span>
                            </FieldLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowClientEmailEditor(true)}
                              disabled={!clientId}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Client Email
                            </Button>
                          </div>

                          <Input
                            type="email"
                            readOnly
                            value={field.state.value?.[0] || previewData.clientEmail || ''}
                            placeholder="No client email on file"
                          />

                          <FieldDescription>
                            Updating this address updates the client profile email used for notifications.
                          </FieldDescription>
                          <FieldError errors={field.state.meta.errors} />
                        </div>
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
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <FieldLegend>Referral Notification</FieldLegend>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-base">Sending to</span>
                      <Badge variant="secondary" className="text-sm">
                        {previewData.referralTitle || 'Referral profile'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReferralEditor(true)}
                    disabled={!clientId || !previewData.referralType}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Referral
                  </Button>
                </div>
                <FieldDescription>
                  Review who receives the collection notification before submitting.
                </FieldDescription>
                <FieldGroup data-slot="checkbox-group">
                  <group.Field name="referralEmailEnabled">
                    {(field) => (
                      <Field orientation="horizontal" data-invalid={field.state.meta.errors.length > 0}>
                        <Checkbox
                          id="referral-enabled"
                          checked={field.state.value}
                          onCheckedChange={(checked) => {
                            field.handleChange(checked === true)
                            validateSubmitState()
                          }}
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
                    {(field) => {
                      const handleOneTimeRecipientsChange = (recipients: string[]) => {
                        field.handleChange([...savedReferralEmails, ...recipients.filter((email) => email.trim())])
                        validateSubmitState()
                      }

                      return (
                        <>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <FieldLabel className="text-base font-semibold">Saved referral recipients</FieldLabel>
                              <FieldDescription>
                                These recipients are saved on the referral and used every time.
                              </FieldDescription>
                            </div>

                            <div className="space-y-2">
                              {savedReferralRecipients.length > 0 ? (
                                savedReferralRecipients.map((recipient) => (
                                  <div
                                    key={recipient.email}
                                    className="border-border bg-background flex items-center justify-between gap-4 rounded-lg border p-4"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-semibold">{recipient.name || 'Saved referral recipient'}</p>
                                      <p className="text-muted-foreground truncate text-base">{recipient.email}</p>
                                    </div>
                                    <Badge variant="secondary">Saved</Badge>
                                  </div>
                                ))
                              ) : (
                                <div className="border-border bg-muted/40 rounded-lg border p-4">
                                  <p className="text-muted-foreground text-base">
                                    No saved referral recipients are available.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <FieldSeparator />

                          <RecipientEditor
                            key={`one-time-recipient-editor-${referralEditorVersion}`}
                            initialRecipients={oneTimeRecipients}
                            onChange={handleOneTimeRecipientsChange}
                            label="One-time email addresses"
                            description="These are added to this send only and do not update the saved referral."
                            recipientLabel="One-time"
                            addButtonLabel="Add One-Time Email"
                            required={false}
                            maxRecipients={10}
                          />

                          <FieldError errors={field.state.meta.errors} />
                        </>
                      )
                    }}
                  </group.Field>
                </FieldSet>
              )}
            </FieldGroup>
          </Card>

          {/* Summary */}
          <Alert variant="info">
            <CheckCircle2 className="size-5" />
            <AlertTitle>Ready to send</AlertTitle>
            <AlertDescription>
              {(() => {
                const clientCount =
                  clientEmailEnabled && clientRecipients && clientRecipients.length > 0 ? clientRecipients.length : 0
                const referralCount = referralEmailEnabled ? savedReferralRecipients.length : 0
                const oneTimeCount = referralEmailEnabled ? validOneTimeRecipientCount : 0
                const totalCount = clientCount + referralCount + oneTimeCount

                if (totalCount === 0) {
                  return <span className="text-destructive">No notifications will be sent</span>
                }

                return (
                  <>
                    {clientCount > 0 && <span>Client recipients: {clientCount}</span>}
                    {referralEmailEnabled && <span>Saved referral recipients: {referralCount}</span>}
                    {referralEmailEnabled && <span>One-time recipients: {oneTimeCount}</span>}
                  </>
                )
              })()}
            </AlertDescription>
            <AlertAction>
              <Button type="button" variant="default" onClick={() => setShowPreview(true)}>
                <Eye className="mr-2 h-4 w-4" />
                Preview Email
              </Button>
            </AlertAction>
          </Alert>

          {/* Email Preview Modals */}
          {showClientPreview && previewData.clientHtml && (
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
          <ReferralProfileDialog
            open={showReferralEditor}
            onOpenChange={setShowReferralEditor}
            clientId={clientId}
            previewData={previewData}
            fallbackReferralEmails={referralRecipients?.length ? referralRecipients : previewData.referralEmails}
            onSaved={handleReferralProfileSavedFromDialog}
          />
          <ClientEmailDialog
            open={showClientEmailEditor}
            onOpenChange={setShowClientEmailEditor}
            clientId={clientId}
            currentEmail={clientRecipients?.[0] || previewData.clientEmail || ''}
            onSaved={handleClientEmailSavedFromDialog}
          />
        </div>
      </div>
    )
  },
})
