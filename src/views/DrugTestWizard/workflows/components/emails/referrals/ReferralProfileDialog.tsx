'use client'

import React from 'react'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  buildInitialReferralProfileValues,
  createRecipientRow,
  getPresetConfigsForUiType,
  type RecipientDetail,
  type ReferralClientType,
  type ReferralProfileFormValues,
  type ReferralTypeUi,
} from './referral-profile-schema'
import { useReferralProfileFormOpts } from './useReferralProfileFormOpts'

type EmailPreviewData = {
  clientType?: ReferralClientType
  referralTitle: string
  referralEmails: string[]
  hasExplicitReferralRecipients?: boolean
  referralRecipientsDetailed?: RecipientDetail[]
}

type ReferralProfileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string | null
  previewData: EmailPreviewData | null
  fallbackReferralEmails: string[]
  onSaved: (data: {
    clientType: ReferralClientType
    referralTitle: string
    referralEmails: string[]
    referralRecipientsDetailed: RecipientDetail[]
  }) => void
}

export function ReferralProfileDialog({
  open,
  onOpenChange,
  clientId,
  previewData,
  fallbackReferralEmails,
  onSaved,
}: ReferralProfileDialogProps) {
  const shouldSeedRecipients =
    !(previewData?.clientType === 'self' && previewData?.hasExplicitReferralRecipients === false)

  const initialValues = buildInitialReferralProfileValues({
    clientType: previewData?.clientType,
    referralTitle: previewData?.referralTitle,
    referralRecipientsDetailed: shouldSeedRecipients ? previewData?.referralRecipientsDetailed : [],
    fallbackReferralEmails: shouldSeedRecipients ? fallbackReferralEmails : [],
  })

  const formOpts = useReferralProfileFormOpts({
    clientId,
    initialValues,
    onClose: () => onOpenChange(false),
    onSaved,
  })

  const form = useAppForm(formOpts)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const referralTypeUi = useStore(form.store, (state) => state.values.referralTypeUi as ReferralTypeUi)
  const wasOpenRef = React.useRef(false)

  const presetConfigs = getPresetConfigsForUiType(referralTypeUi)

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      form.reset(initialValues)
    }

    wasOpenRef.current = open
  }, [form, initialValues, open])

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset(initialValues)
    }

    onOpenChange(nextOpen)
  }

  function setValueWithFieldApi<TValue>(name: keyof ReferralProfileFormValues, value: TValue) {
    const fieldInstance = form.getFieldInfo(name)?.instance as any

    if (fieldInstance && typeof fieldInstance.handleChange === 'function') {
      fieldInstance.handleChange(value)
      return
    }

    form.setFieldValue(name, value as any)
  }

  function replaceRecipientsWithFieldApi(nextRows: ReferralProfileFormValues['recipients']) {
    const recipientsField = form.getFieldInfo('recipients')?.instance as any

    if (
      recipientsField &&
      typeof recipientsField.clearValues === 'function' &&
      typeof recipientsField.pushValue === 'function'
    ) {
      recipientsField.clearValues()
      nextRows.forEach((row) => {
        recipientsField.pushValue(row)
      })
      return
    }

    form.setFieldValue('recipients', nextRows as any)
  }

  async function revalidateProgrammaticChanges() {
    const unsafeForm = form as any
    await form.validateField('title', 'submit')
    if (typeof unsafeForm.validateArrayFieldsStartingFrom === 'function') {
      await unsafeForm.validateArrayFieldsStartingFrom('recipients', 0, 'submit')
    }
    await form.validate('submit')
  }

  async function applyReferralTypeChange(nextType: ReferralTypeUi) {
    setValueWithFieldApi('referralTypeUi', nextType)
    setValueWithFieldApi('presetKey', 'custom')
    setValueWithFieldApi('title', nextType === 'self' ? 'Self' : '')
    replaceRecipientsWithFieldApi(nextType === 'self' ? [] : [createRecipientRow()])
    await revalidateProgrammaticChanges()
  }

  async function applyPresetChange(nextPresetKey: string) {
    setValueWithFieldApi('presetKey', nextPresetKey)

    if (nextPresetKey === 'custom') {
      await revalidateProgrammaticChanges()
      return
    }

    const activeType = form.getFieldValue('referralTypeUi') as ReferralTypeUi
    const activeConfigs = getPresetConfigsForUiType(activeType)
    const preset = activeConfigs?.[nextPresetKey]
    if (!preset) {
      return
    }

    setValueWithFieldApi('title', preset.label)
    const nextRows =
      preset.recipients.length > 0
        ? preset.recipients.map((recipient) => createRecipientRow(recipient))
        : [createRecipientRow()]
    replaceRecipientsWithFieldApi(nextRows)
    await revalidateProgrammaticChanges()
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Referral Profile</DialogTitle>
          <DialogDescription>
            Update referral type, referral name, and recipients without leaving the workflow.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (event) => {
            event.preventDefault()
            event.stopPropagation()
            await form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field name="referralTypeUi">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="referral-type">Referral Type</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    void applyReferralTypeChange(value as ReferralTypeUi)
                  }}
                >
                  <SelectTrigger id="referral-type">
                    <SelectValue placeholder="Select referral type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="court">Court</SelectItem>
                    <SelectItem value="employer">Employer</SelectItem>
                    <SelectItem value="self">Self</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          {presetConfigs && (
            <form.Field name="presetKey">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="referral-preset">
                    {referralTypeUi === 'court' ? 'Court Preset' : 'Employer Preset'}
                  </Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      void applyPresetChange(value)
                    }}
                  >
                    <SelectTrigger id="referral-preset">
                      <SelectValue placeholder="Choose preset or keep custom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                      {Object.entries(presetConfigs).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          )}

          <form.Field name="title">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Referral Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Court, employer, or referral name"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="recipients" mode="array">
            {(field) => (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Recipients</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.pushValue(createRecipientRow())}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Recipient
                  </Button>
                </div>

                {referralTypeUi === 'self' && field.state.value.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Recipients are optional for self referral type.
                  </p>
                )}

                {field.state.value.map((recipient, index) => (
                  <div key={recipient.rowId} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <form.Field name={`recipients[${index}].name` as const}>
                      {(nameField) => (
                        <div className="space-y-1">
                          <Input
                            value={nameField.state.value}
                            onChange={(event) => nameField.handleChange(event.target.value)}
                            onBlur={nameField.handleBlur}
                            placeholder="Recipient name"
                          />
                          <FieldError errors={nameField.state.meta.errors} className="text-xs" />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name={`recipients[${index}].email` as const}>
                      {(emailField) => (
                        <div className="space-y-1">
                          <Input
                            value={emailField.state.value}
                            onChange={(event) => emailField.handleChange(event.target.value)}
                            onBlur={emailField.handleBlur}
                            placeholder="recipient@example.com"
                            type="email"
                          />
                          <FieldError errors={emailField.state.meta.errors} className="text-xs" />
                        </div>
                      )}
                    </form.Field>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => field.removeValue(index)}
                      disabled={referralTypeUi !== 'self' && field.state.value.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Referral
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
