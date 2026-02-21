'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { useEmployerOptions } from '@/app/(frontend)/register/hooks/useEmployerOptions'
import { useCourtOptions } from '@/app/(frontend)/register/hooks/useCourtOptions'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { FieldError } from '@/components/ui/field'
import { Button } from '@/components/ui/button'

export const RecipientsStep = withForm({
  ...getRegisterClientFormOpts('recipients'),

  render: function Render({ form }) {
    const { employers, employersById, isLoading: isLoadingEmployers } = useEmployerOptions()
    const { courts, courtsById, isLoading: isLoadingCourts } = useCourtOptions()

    const requestedBy = useStore(form.store, (state) => state.values.screeningType.requestedBy)
    const selectedEmployerValue = useStore(form.store, (state) => state.values.recipients.selectedEmployer)
    const selectedCourtValue = useStore(form.store, (state) => state.values.recipients.selectedCourt)

    const selectedEmployer = selectedEmployerValue ? employersById.get(selectedEmployerValue) || null : null
    const selectedCourt = selectedCourtValue ? courtsById.get(selectedCourtValue) || null : null

    const renderSelfFields = () => (
      <>
        {renderAdditionalReferralRecipientFields()}
      </>
    )

    const renderAdditionalReferralRecipientFields = () => (
      <form.Field name="recipients.additionalReferralRecipients" mode="array">
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
                      <form.AppField name={`recipients.additionalReferralRecipients[${index}].name` as const}>
                        {(nameField) => <nameField.TextField label="Recipient Name (optional)" />}
                      </form.AppField>
                      <form.AppField name={`recipients.additionalReferralRecipients[${index}].email` as const}>
                        {(emailField) => <emailField.EmailField label="Recipient Email" required />}
                      </form.AppField>
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
      </form.Field>
    )

    const renderOtherEmployerPresetRecipientFields = () => (
      <div className="mt-2 space-y-4">
        <form.Field name="recipients.otherEmployerAdditionalRecipients" mode="array">
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
                        <form.AppField name={`recipients.otherEmployerAdditionalRecipients[${index}].name` as const}>
                          {(nameField) => <nameField.TextField label="Recipient Name (optional)" />}
                        </form.AppField>
                        <form.AppField name={`recipients.otherEmployerAdditionalRecipients[${index}].email` as const}>
                          {(emailField) => <emailField.EmailField label="Recipient Email" required />}
                        </form.AppField>
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
        </form.Field>
      </div>
    )

    const renderOtherCourtPresetRecipientFields = () => (
      <div className="mt-2 space-y-4">
        <form.Field name="recipients.otherCourtAdditionalRecipients" mode="array">
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
                        <form.AppField name={`recipients.otherCourtAdditionalRecipients[${index}].name` as const}>
                          {(nameField) => <nameField.TextField label="Recipient Name (optional)" />}
                        </form.AppField>
                        <form.AppField name={`recipients.otherCourtAdditionalRecipients[${index}].email` as const}>
                          {(emailField) => <emailField.EmailField label="Recipient Email" required />}
                        </form.AppField>
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
        </form.Field>
      </div>
    )

    const renderEmployerFields = () => {
      const isOther = selectedEmployerValue === 'other'

      return (
        <>
          <form.AppField name="recipients.selectedEmployer">
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
          </form.AppField>

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
              <form.AppField name="recipients.otherEmployerName">
                {(field) => <field.TextField label="Employer Name" required />}
              </form.AppField>
              <form.AppField name="recipients.otherEmployerMainContactName">
                {(field) => <field.TextField label="Contact Name (optional)" />}
              </form.AppField>
              <form.AppField name="recipients.otherEmployerMainContactEmail">
                {(field) => <field.EmailField label="Contact Email" required />}
              </form.AppField>
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
          <form.AppField name="recipients.selectedCourt">
            {(field) => (
              <div className="space-y-2">
                <label htmlFor="court-select" className="text-foreground block text-sm font-medium">
                  Select Court <span className="text-destructive">*</span>
                </label>
                <select
                  id="court-select"
                  value={field.state.value || ''}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isLoadingCourts}
                  className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                >
                  <option value="">-- Select a court --</option>
                  {courts.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.name}
                    </option>
                  ))}
                  <option value="other">Other (Add new court)</option>
                </select>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.AppField>

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
              <form.AppField name="recipients.otherCourtName">
                {(field) => <field.TextField label="Court Name" required />}
              </form.AppField>
              <form.AppField name="recipients.otherCourtMainContactName">
                {(field) => <field.TextField label="Contact Name (optional)" />}
              </form.AppField>
              <form.AppField name="recipients.otherCourtMainContactEmail">
                {(field) => <field.EmailField label="Contact Email" required />}
              </form.AppField>
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
