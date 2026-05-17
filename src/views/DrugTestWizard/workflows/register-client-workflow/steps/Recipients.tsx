'use client'

import { withFieldGroup, withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import type { FormValues } from '../validators'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { useEmployerOptions } from '@/app/(frontend)/register/hooks/useEmployerOptions'
import { useCourtOptions } from '@/app/(frontend)/register/hooks/useCourtOptions'
import { groupCourtSelectOptions } from '@/app/(frontend)/register/utils/groupCourtSelectOptions'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const defaultRequestedBy: FormValues['screeningType']['requestedBy'] = ''
const recipientsFieldProps: { requestedBy: FormValues['screeningType']['requestedBy'] } = {
  requestedBy: defaultRequestedBy,
}

const RecipientsFields = withFieldGroup({
  defaultValues: getRegisterClientFormOpts().defaultValues.recipients,
  props: recipientsFieldProps,

  render: function Render({ group, requestedBy }) {
    const CLEAR_SELECTION_VALUE = '__none__'
    const { employers, employersById, isLoading: isLoadingEmployers } = useEmployerOptions()
    const { courts, courtsById, isLoading: isLoadingCourts } = useCourtOptions()
    const groupedCourtOptions = groupCourtSelectOptions(courts)

    const selectedEmployerValue = useStore(group.store, (state) => state.values.selectedEmployer)
    const selectedCourtValue = useStore(group.store, (state) => state.values.selectedCourt)

    const selectedEmployer = selectedEmployerValue ? employersById.get(selectedEmployerValue) || null : null
    const selectedCourt = selectedCourtValue ? courtsById.get(selectedCourtValue) || null : null

    const renderSelfFields = () => (
      <>
        {renderAdditionalReferralRecipientFields()}
      </>
    )

    const renderAdditionalReferralRecipientFields = () => (
      <group.Field name="additionalReferralRecipients" mode="array">
        {(field) => {
          const rows = field.state.value || []
          const referralScopeDescription =
            requestedBy === 'court'
              ? 'These recipients are for you and are separate from your selected court referral.'
              : requestedBy === 'employer'
                ? 'These recipients are for you and are separate from your selected employer referral.'
                : 'These recipients are for you and are not linked to a court or employer referral.'

          return (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-foreground text-sm font-medium">Additional recipients for you only</p>
                  <p className="text-muted-foreground text-xs">{referralScopeDescription}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => field.pushValue({ name: '', email: '' })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipient
                </Button>
              </div>

              {rows.length === 0 ? (
                <p className="text-muted-foreground text-sm">No additional recipients added.</p>
              ) : (
                <div className="space-y-3">
                  {rows.map((_, index) => (
                    <div key={`additional-recipient-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <group.AppField name={`additionalReferralRecipients[${index}].name` as const}>
                        {(nameField) => <nameField.TextField label="Recipient Name (optional)" />}
                      </group.AppField>
                      <group.AppField name={`additionalReferralRecipients[${index}].email` as const}>
                        {(emailField) => <emailField.EmailField label="Recipient Email" required />}
                      </group.AppField>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mt-8"
                        onClick={() => field.removeValue(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <FieldError errors={field.state.meta.errors} />
            </div>
          )
        }}
      </group.Field>
    )

    const renderOtherEmployerPresetRecipientFields = () => (
      <div className="mt-2 space-y-4">
        <group.Field name="otherEmployerAdditionalRecipients" mode="array">
          {(field) => {
            const rows = field.state.value || []

            return (
              <div className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">Additional recipients for the new employer</p>
                    <p className="text-muted-foreground text-xs">Saved to the new employer referral profile.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => field.pushValue({ name: '', email: '' })}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Recipient
                  </Button>
                </div>

                {rows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No extra recipients added for this new employer referral.</p>
                ) : (
                  <div className="space-y-3">
                    {rows.map((_, index) => (
                      <div key={`other-employer-recipient-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <group.AppField name={`otherEmployerAdditionalRecipients[${index}].name` as const}>
                          {(nameField) => <nameField.TextField label="Recipient Name (optional)" />}
                        </group.AppField>
                        <group.AppField name={`otherEmployerAdditionalRecipients[${index}].email` as const}>
                          {(emailField) => <emailField.EmailField label="Recipient Email" required />}
                        </group.AppField>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="mt-8"
                          onClick={() => field.removeValue(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <FieldError errors={field.state.meta.errors} />
              </div>
            )
          }}
        </group.Field>
      </div>
    )

    const renderOtherCourtPresetRecipientFields = () => (
      <div className="mt-2 space-y-4">
        <group.Field name="otherCourtAdditionalRecipients" mode="array">
          {(field) => {
            const rows = field.state.value || []

            return (
              <div className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">Additional recipients for the new court</p>
                    <p className="text-muted-foreground text-xs">Saved to the new court referral profile.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => field.pushValue({ name: '', email: '' })}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Recipient
                  </Button>
                </div>

                {rows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No extra recipients added for this new court referral.</p>
                ) : (
                  <div className="space-y-3">
                    {rows.map((_, index) => (
                      <div key={`other-court-recipient-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <group.AppField name={`otherCourtAdditionalRecipients[${index}].name` as const}>
                          {(nameField) => <nameField.TextField label="Recipient Name (optional)" />}
                        </group.AppField>
                        <group.AppField name={`otherCourtAdditionalRecipients[${index}].email` as const}>
                          {(emailField) => <emailField.EmailField label="Recipient Email" required />}
                        </group.AppField>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="mt-8"
                          onClick={() => field.removeValue(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <FieldError errors={field.state.meta.errors} />
              </div>
            )
          }}
        </group.Field>
      </div>
    )

    const renderEmployerFields = () => {
      const isOther = selectedEmployerValue === 'other'

      return (
        <>
          <group.AppField name="selectedEmployer">
            {(field) => (
              <div className="space-y-2">
                <label htmlFor="employer-select" className="text-foreground block text-sm font-medium">
                  Select Employer <span className="text-destructive">*</span>
                </label>
                <select
                  id="employer-select"
                  value={field.state.value || ''}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isLoadingEmployers}
                  className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                >
                  <option value="">-- Select an employer --</option>
                  {employers.map((employer) => (
                    <option key={employer.id} value={employer.id}>
                      {employer.name}
                    </option>
                  ))}
                  <option value="other">Other (Add new employer)</option>
                </select>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </group.AppField>

          {selectedEmployer?.preferredTestTypeLabel && (
            <div className="bg-muted/50 border-border rounded-lg border p-4">
              <p className="text-foreground text-sm">
                Preferred test type: <span className="font-medium">{selectedEmployer.preferredTestTypeLabel}</span>
              </p>
            </div>
          )}

          {selectedEmployer && (
            <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
              <p className="text-foreground mb-2 text-sm font-medium">Results will be sent to:</p>
              <ul className="space-y-1">
                {selectedEmployer.recipientEmails.map((email) => (
                  <li key={email} className="text-muted-foreground text-sm">
                    • {email}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOther && (
            <>
              <group.AppField name="otherEmployerName">
                {(field) => <field.TextField label="Employer Name" required />}
              </group.AppField>
              <group.AppField name="otherEmployerMainContactName">
                {(field) => <field.TextField label="Contact Name (optional)" />}
              </group.AppField>
              <group.AppField name="otherEmployerMainContactEmail">
                {(field) => <field.EmailField label="Contact Email" required />}
              </group.AppField>
              {renderOtherEmployerPresetRecipientFields()}
            </>
          )}

          <div className="border-border border-t pt-4" />
          {renderAdditionalReferralRecipientFields()}
        </>
      )
    }

    const renderCourtFields = () => {
      const isOther = selectedCourtValue === 'other'

      return (
        <>
          <group.AppField name="selectedCourt">
            {(field) => {
              const errors = field.state.meta.errors
              const hasErrors = errors.length > 0
              return (
                <Field data-invalid={hasErrors}>
                  <FieldLabel htmlFor="court-select">
                    Select Court <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={field.state.value || ''}
                    onValueChange={(value) => field.handleChange(value === CLEAR_SELECTION_VALUE ? '' : value)}
                    disabled={isLoadingCourts}
                  >
                    <SelectTrigger id="court-select" className="w-full" aria-invalid={hasErrors || undefined}>
                      <SelectValue placeholder={isLoadingCourts ? 'Loading courts...' : 'Select a court'} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingCourts ? (
                        <SelectItem value={CLEAR_SELECTION_VALUE} disabled>
                          Loading courts...
                        </SelectItem>
                      ) : (
                        <>
                          <SelectItem value={CLEAR_SELECTION_VALUE}>-- Select a court --</SelectItem>
                          {groupedCourtOptions.map((optionOrGroup) =>
                            'groupLabel' in optionOrGroup ? (
                              <SelectGroup key={optionOrGroup.groupLabel}>
                                <SelectLabel>{optionOrGroup.groupLabel}</SelectLabel>
                                {optionOrGroup.options.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ) : (
                              <SelectItem key={optionOrGroup.value} value={optionOrGroup.value}>
                                {optionOrGroup.label}
                              </SelectItem>
                            ),
                          )}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FieldError errors={errors} />
                </Field>
              )
            }}
          </group.AppField>

          {selectedCourt && (
            <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
              {selectedCourt.preferredTestTypeLabel && (
                <p className="text-foreground mb-2 text-sm">
                  Preferred test type: <span className="font-medium">{selectedCourt.preferredTestTypeLabel}</span>
                </p>
              )}
              <p className="text-foreground mb-2 text-sm font-medium">Results will be sent to:</p>
              <ul className="space-y-1">
                {selectedCourt.recipientEmails.map((email) => (
                  <li key={email} className="text-muted-foreground text-sm">
                    • {email}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOther && (
            <>
              <group.AppField name="otherCourtName">
                {(field) => <field.TextField label="Court Name" required />}
              </group.AppField>
              <group.AppField name="otherCourtMainContactName">
                {(field) => <field.TextField label="Contact Name (optional)" />}
              </group.AppField>
              <group.AppField name="otherCourtMainContactEmail">
                {(field) => <field.EmailField label="Contact Email" required />}
              </group.AppField>
              {renderOtherCourtPresetRecipientFields()}
            </>
          )}

          <div className="border-border border-t pt-4" />
          {renderAdditionalReferralRecipientFields()}
        </>
      )
    }

    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Results Recipients" description="Where should results be sent?" />

        {requestedBy === 'self' && renderSelfFields()}
        {requestedBy === 'employer' && renderEmployerFields()}
        {requestedBy === 'court' && renderCourtFields()}

        {!requestedBy && (
          <div className="bg-muted/50 border-muted rounded-lg border p-4 text-center">
            <p className="text-muted-foreground text-sm">
              Please select who is requesting this screening in the previous step to configure the results recipient.
            </p>
          </div>
        )}
      </div>
    )
  },
})

export const RecipientsStep = withForm({
  ...getRegisterClientFormOpts(),
  render: function Render({ form }) {
    const requestedBy = useStore(form.store, (state) => state.values.screeningType.requestedBy)

    return <RecipientsFields form={form} fields="recipients" requestedBy={requestedBy} />
  },
})
