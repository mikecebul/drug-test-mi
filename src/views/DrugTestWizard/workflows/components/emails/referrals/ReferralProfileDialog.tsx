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
  type RecipientDetail,
  type PresetConfigMap,
  type ReferralClientType,
  type ReferralProfileFormValues,
  type ReferralTypeUi,
} from './referral-profile-schema'
import { useReferralProfileFormOpts } from './useReferralProfileFormOpts'
import { useCourtOptions } from '@/app/(frontend)/register/hooks/useCourtOptions'
import { useEmployerOptions } from '@/app/(frontend)/register/hooks/useEmployerOptions'

type EmailPreviewData = {
  referralType?: ReferralClientType
  referralTitle: string
  referralEmails: string[]
  referralPresetId?: string
  hasExplicitReferralRecipients?: boolean
  referralRecipientsDetailed?: RecipientDetail[]
  clientAdditionalRecipientsDetailed?: RecipientDetail[]
}

type ReferralProfileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string | null
  previewData: EmailPreviewData | null
  fallbackReferralEmails: string[]
  onSaved: (data: {
    referralType: ReferralClientType
    referralTitle: string
    referralEmails: string[]
    referralRecipientsDetailed: RecipientDetail[]
    clientAdditionalRecipientsDetailed: RecipientDetail[]
    referralPresetId?: string
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
    !(previewData?.referralType === 'self' && previewData?.hasExplicitReferralRecipients === false)

  const initialValues = buildInitialReferralProfileValues({
    clientType: previewData?.referralType,
    referralPresetId: previewData?.referralPresetId,
    referralTitle: previewData?.referralTitle,
    referralRecipientsDetailed: shouldSeedRecipients ? previewData?.referralRecipientsDetailed : [],
    clientAdditionalRecipientsDetailed: shouldSeedRecipients ? previewData?.clientAdditionalRecipientsDetailed : [],
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
  const presetKey = useStore(form.store, (state) => state.values.presetKey)
  const wasOpenRef = React.useRef(false)
  const { courts } = useCourtOptions({ includeInactive: true })
  const { employers } = useEmployerOptions({ includeInactive: true })

  const courtPresets = React.useMemo<PresetConfigMap>(() => {
    return courts.reduce<PresetConfigMap>((acc, court) => {
      const recipients = court.contacts.map((contact) => ({
        name: contact.name || '',
        email: contact.email,
      }))
      acc[court.id] = {
        label: court.name,
        recipients,
      }
      return acc
    }, {})
  }, [courts])

  const employerPresets = React.useMemo<PresetConfigMap>(() => {
    return employers.reduce<PresetConfigMap>((acc, employer) => {
      const recipients = employer.contacts.map((contact) => ({
        name: contact.name || '',
        email: contact.email,
      }))
      acc[employer.id] = {
        label: employer.name,
        recipients,
      }
      return acc
    }, {})
  }, [employers])

  const presetConfigs = referralTypeUi === 'court'
    ? courtPresets
    : referralTypeUi === 'employer'
      ? employerPresets
      : null
  const isPresetLocked = referralTypeUi !== 'self' && presetKey !== 'custom'

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

  function replaceAdditionalRecipientsWithFieldApi(nextRows: ReferralProfileFormValues['additionalRecipients']) {
    const recipientsField = form.getFieldInfo('additionalRecipients')?.instance as any

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

    form.setFieldValue('additionalRecipients', nextRows as any)
  }

  async function revalidateProgrammaticChanges() {
    const unsafeForm = form as any
    await form.validateField('title', 'submit')
    if (typeof unsafeForm.validateArrayFieldsStartingFrom === 'function') {
      await unsafeForm.validateArrayFieldsStartingFrom('recipients', 0, 'submit')
      await unsafeForm.validateArrayFieldsStartingFrom('additionalRecipients', 0, 'submit')
    }
    await form.validate('submit')
  }

  async function applyReferralTypeChange(nextType: ReferralTypeUi) {
    setValueWithFieldApi('referralTypeUi', nextType)
    setValueWithFieldApi('presetKey', 'custom')
    setValueWithFieldApi('title', nextType === 'self' ? 'Self' : '')
    replaceRecipientsWithFieldApi(nextType === 'self' ? [] : [createRecipientRow()])
    replaceAdditionalRecipientsWithFieldApi([])
    await revalidateProgrammaticChanges()
  }

  async function applyPresetChange(nextPresetKey: string) {
    setValueWithFieldApi('presetKey', nextPresetKey)

    if (nextPresetKey === 'custom') {
      await revalidateProgrammaticChanges()
      return
    }

    const activeType = form.getFieldValue('referralTypeUi') as ReferralTypeUi
    const activeConfigs =
      activeType === 'court' ? courtPresets : activeType === 'employer' ? employerPresets : null
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
                  <Label>{isPresetLocked ? 'Referral Recipients (Preset)' : 'Recipients'}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.pushValue(createRecipientRow())}
                    disabled={isPresetLocked}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Recipient
                  </Button>
                </div>
                {isPresetLocked && (
                  <p className="text-muted-foreground text-xs">
                    Preset recipients are read-only. Use additional recipients below for client-specific contacts.
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Name is optional. Email is required. The first recipient is treated as the main contact.
                </p>

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
                            placeholder="Recipient name (optional)"
                            readOnly={isPresetLocked}
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
                            readOnly={isPresetLocked}
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
                      disabled={isPresetLocked || (referralTypeUi !== 'self' && field.state.value.length <= 1)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          {referralTypeUi !== 'self' && (
            <form.Field name="additionalRecipients" mode="array">
              {(field) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Additional Recipients (Client-Specific)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => field.pushValue(createRecipientRow())}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Recipient
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    These recipients are attached only to this client and do not modify the linked court or employer.
                  </p>

                  {field.state.value.length === 0 && (
                    <p className="text-muted-foreground text-sm">No client-specific additional recipients.</p>
                  )}

                  {field.state.value.map((recipient, index) => (
                    <div key={recipient.rowId} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <form.Field name={`additionalRecipients[${index}].name` as const}>
                        {(nameField) => (
                          <div className="space-y-1">
                            <Input
                              value={nameField.state.value}
                              onChange={(event) => nameField.handleChange(event.target.value)}
                              onBlur={nameField.handleBlur}
                              placeholder="Recipient name (optional)"
                            />
                            <FieldError errors={nameField.state.meta.errors} className="text-xs" />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name={`additionalRecipients[${index}].email` as const}>
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

                      <Button type="button" variant="outline" size="icon" onClick={() => field.removeValue(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>
          )}

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
