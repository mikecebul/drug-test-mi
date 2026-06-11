'use client'

import React from 'react'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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

type ReferralProfileDrawerProps = {
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

export function ReferralProfileDrawer({
  open,
  onOpenChange,
  clientId,
  previewData,
  fallbackReferralEmails,
  onSaved,
}: ReferralProfileDrawerProps) {
  const shouldSeedRecipients = !(
    previewData?.referralType === 'self' && previewData?.hasExplicitReferralRecipients === false
  )

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

  const presetConfigs =
    referralTypeUi === 'court' ? courtPresets : referralTypeUi === 'employer' ? employerPresets : null
  const isPresetLocked = referralTypeUi !== 'self' && presetKey !== 'custom'

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      form.reset(initialValues)
    }

    wasOpenRef.current = open
  }, [form, initialValues, open])

  function handleDrawerOpenChange(nextOpen: boolean) {
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
      setValueWithFieldApi('title', '')
      replaceRecipientsWithFieldApi([createRecipientRow()])
      replaceAdditionalRecipientsWithFieldApi([])
      await revalidateProgrammaticChanges()
      return
    }

    const activeType = form.getFieldValue('referralTypeUi') as ReferralTypeUi
    const activeConfigs = activeType === 'court' ? courtPresets : activeType === 'employer' ? employerPresets : null
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
    <Drawer direction="right" open={open} onOpenChange={handleDrawerOpenChange}>
      <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(48rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
        <DrawerHeader className="px-6 pt-6 pb-2">
          <DrawerTitle className="text-2xl tracking-tight">Edit Referral Profile</DrawerTitle>
        </DrawerHeader>

        <form
          onSubmit={async (event) => {
            event.preventDefault()
            event.stopPropagation()
            await form.handleSubmit()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-6 pt-4 pb-6">
            <form.Field name="referralTypeUi">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="referral-type">Referral Type</FieldLabel>
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
                </Field>
              )}
            </form.Field>

            {presetConfigs && (
              <form.Field name="presetKey">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="referral-preset">
                      {referralTypeUi === 'court' ? 'Court Preset' : 'Employer Preset'}
                    </FieldLabel>
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
                  </Field>
                )}
              </form.Field>
            )}

            <form.Field name="title">
              {(field) => {
                const errors = field.state.meta.errors
                const hasErrors = errors.length > 0

                return (
                  <Field data-invalid={hasErrors}>
                    <FieldLabel htmlFor={field.name}>Referral Name</FieldLabel>
                    <Input
                      id={field.name}
                      aria-invalid={hasErrors || undefined}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="Court, employer, or referral name"
                      readOnly={isPresetLocked}
                    />
                    <FieldError errors={errors} />
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="recipients" mode="array">
              {(field) => (
                <FieldSet className="border-border bg-card gap-5 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <FieldLegend variant="label" className="mb-0">
                      {isPresetLocked ? 'Referral Recipients (Preset)' : 'Recipients'}
                    </FieldLegend>
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

                  <FieldGroup className="gap-4">
                    {field.state.value.map((recipient, index) => (
                      <div key={recipient.rowId} className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
                        <form.Field name={`recipients[${index}].name` as const}>
                          {(nameField) => {
                            const errors = nameField.state.meta.errors
                            const hasErrors = errors.length > 0

                            return (
                              <Field data-invalid={hasErrors}>
                                <FieldLabel htmlFor={nameField.name} className="sr-only">
                                  Recipient name
                                </FieldLabel>
                                <Input
                                  id={nameField.name}
                                  aria-invalid={hasErrors || undefined}
                                  value={nameField.state.value}
                                  onChange={(event) => nameField.handleChange(event.target.value)}
                                  onBlur={nameField.handleBlur}
                                  placeholder="Recipient name (optional)"
                                  readOnly={isPresetLocked}
                                />
                                <FieldError errors={errors} className="text-xs" />
                              </Field>
                            )
                          }}
                        </form.Field>

                        <form.Field name={`recipients[${index}].email` as const}>
                          {(emailField) => {
                            const errors = emailField.state.meta.errors
                            const hasErrors = errors.length > 0

                            return (
                              <Field data-invalid={hasErrors}>
                                <FieldLabel htmlFor={emailField.name} className="sr-only">
                                  Recipient email
                                </FieldLabel>
                                <Input
                                  id={emailField.name}
                                  aria-invalid={hasErrors || undefined}
                                  value={emailField.state.value}
                                  onChange={(event) => emailField.handleChange(event.target.value)}
                                  onBlur={emailField.handleBlur}
                                  placeholder="recipient@example.com"
                                  type="email"
                                  readOnly={isPresetLocked}
                                />
                                <FieldError errors={errors} className="text-xs" />
                              </Field>
                            )
                          }}
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
                  </FieldGroup>

                  <FieldError errors={field.state.meta.errors} />
                </FieldSet>
              )}
            </form.Field>

            {referralTypeUi !== 'self' && (
              <form.Field name="additionalRecipients" mode="array">
                {(field) => (
                  <FieldSet className="border-border bg-card gap-5 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <FieldLegend variant="label" className="mb-0">
                        Additional Recipients (Client-Specific)
                      </FieldLegend>
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

                    <FieldGroup className="gap-4">
                      {field.state.value.map((recipient, index) => (
                        <div key={recipient.rowId} className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
                          <form.Field name={`additionalRecipients[${index}].name` as const}>
                            {(nameField) => {
                              const errors = nameField.state.meta.errors
                              const hasErrors = errors.length > 0

                              return (
                                <Field data-invalid={hasErrors}>
                                  <FieldLabel htmlFor={nameField.name} className="sr-only">
                                    Additional recipient name
                                  </FieldLabel>
                                  <Input
                                    id={nameField.name}
                                    aria-invalid={hasErrors || undefined}
                                    value={nameField.state.value}
                                    onChange={(event) => nameField.handleChange(event.target.value)}
                                    onBlur={nameField.handleBlur}
                                    placeholder="Recipient name (optional)"
                                  />
                                  <FieldError errors={errors} className="text-xs" />
                                </Field>
                              )
                            }}
                          </form.Field>

                          <form.Field name={`additionalRecipients[${index}].email` as const}>
                            {(emailField) => {
                              const errors = emailField.state.meta.errors
                              const hasErrors = errors.length > 0

                              return (
                                <Field data-invalid={hasErrors}>
                                  <FieldLabel htmlFor={emailField.name} className="sr-only">
                                    Additional recipient email
                                  </FieldLabel>
                                  <Input
                                    id={emailField.name}
                                    aria-invalid={hasErrors || undefined}
                                    value={emailField.state.value}
                                    onChange={(event) => emailField.handleChange(event.target.value)}
                                    onBlur={emailField.handleBlur}
                                    placeholder="recipient@example.com"
                                    type="email"
                                  />
                                  <FieldError errors={errors} className="text-xs" />
                                </Field>
                              )
                            }}
                          </form.Field>

                          <Button type="button" variant="outline" size="icon" onClick={() => field.removeValue(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </FieldGroup>

                    <FieldError errors={field.state.meta.errors} />
                  </FieldSet>
                )}
              </form.Field>
            )}
          </div>

          <DrawerFooter className="px-6 pt-2 pb-6 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleDrawerOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Referral
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
