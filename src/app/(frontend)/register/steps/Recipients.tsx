'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { useStore } from '@tanstack/react-form'
import { useEmployerOptions } from '../hooks/useEmployerOptions'
import { useCourtOptions } from '../hooks/useCourtOptions'

export const RecipientsStep = withForm({
  ...getRegisterClientFormOpts('recipients'),

  render: function Render({ form }) {
    const { employers, employersById, isLoading: isLoadingEmployers } = useEmployerOptions()
    const { courts, courtsById, isLoading: isLoadingCourts } = useCourtOptions()

    const requestedBy = useStore(form.store, (state) => state.values.screeningType.requestedBy)
    const sendToOther = useStore(form.store, (state) => state.values.recipients.sendToOther)
    const selectedEmployerValue = useStore(form.store, (state) => state.values.recipients.selectedEmployer)
    const selectedCourtValue = useStore(form.store, (state) => state.values.recipients.selectedCourt)

    const selectedEmployer = selectedEmployerValue ? employersById.get(selectedEmployerValue) || null : null
    const selectedCourt = selectedCourtValue ? courtsById.get(selectedCourtValue) || null : null

    const renderSelfFields = () => (
      <>
        <form.AppField name="recipients.sendToOther">
          {(field) => (
            <div className="space-y-3">
              <label className="text-foreground block text-sm font-medium">Who should receive the test results?</label>
              <div className="space-y-2">
                <label
                  className={`hover:bg-accent/50 flex cursor-pointer items-center rounded-lg border-2 p-3 transition-all ${
                    sendToOther === false ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    checked={sendToOther === false}
                    onChange={() => field.handleChange(false)}
                    className="text-primary border-border focus:ring-primary h-4 w-4"
                  />
                  <span className="text-foreground ml-3 text-sm font-medium">Send results to me only</span>
                </label>
                <label
                  className={`hover:bg-accent/50 flex cursor-pointer items-center rounded-lg border-2 p-3 transition-all ${
                    sendToOther === true ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    checked={sendToOther === true}
                    onChange={() => field.handleChange(true)}
                    className="text-primary border-border focus:ring-primary h-4 w-4"
                  />
                  <span className="text-foreground ml-3 text-sm font-medium">Also send to someone else</span>
                </label>
              </div>
            </div>
          )}
        </form.AppField>

        {sendToOther === true && (
          <>
            <form.AppField name="recipients.selfRecipients[0].name">
              {(field) => <field.TextField label="Recipient Name" required />}
            </form.AppField>
            <form.AppField name="recipients.selfRecipients[0].email">
              {(field) => <field.EmailField label="Recipient Email" required />}
            </form.AppField>
          </>
        )}
      </>
    )

    const renderEmployerFields = () => {
      const isOther = selectedEmployerValue === 'other'

      return (
        <>
          <form.AppField name="recipients.selectedEmployer">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
                <div className="space-y-2">
                  <label htmlFor="employer-select" className="text-foreground block text-sm font-medium">
                    Select Employer <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="employer-select"
                    value={field.state.value || ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    disabled={isLoadingEmployers}
                    aria-invalid={hasErrors || undefined}
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
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-destructive text-sm">{String(field.state.meta.errors[0]?.message)}</p>
                  )}
                </div>
              )
            }}
          </form.AppField>

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
              <form.AppField name="recipients.otherEmployerRecipientEmails">
                {(field) => (
                  <div className="space-y-2">
                    <label htmlFor={field.name} className="text-foreground block text-sm font-medium">
                      Additional Recipient Emails
                    </label>
                    <textarea
                      id={field.name}
                      value={field.state.value || ''}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      rows={3}
                      className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                      placeholder="email1@example.com, email2@example.com"
                    />
                    <p className="text-muted-foreground text-xs">
                      Optional additional emails, comma or newline separated. The contact email above is treated as the main contact.
                    </p>
                  </div>
                )}
              </form.AppField>
            </>
          )}
        </>
      )
    }

    const renderCourtFields = () => {
      const isOther = selectedCourtValue === 'other'

      return (
        <>
          <form.AppField name="recipients.selectedCourt">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
                <div className="space-y-2">
                  <label htmlFor="court-select" className="text-foreground block text-sm font-medium">
                    Select Court <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="court-select"
                    value={field.state.value || ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    disabled={isLoadingCourts}
                    aria-invalid={hasErrors || undefined}
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
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-destructive text-sm">{String(field.state.meta.errors[0]?.message)}</p>
                  )}
                </div>
              )
            }}
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
              <form.AppField name="recipients.otherCourtRecipientEmails">
                {(field) => (
                  <div className="space-y-2">
                    <label htmlFor={field.name} className="text-foreground block text-sm font-medium">
                      Additional Recipient Emails
                    </label>
                    <textarea
                      id={field.name}
                      value={field.state.value || ''}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      rows={3}
                      className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                      placeholder="email1@example.com, email2@example.com"
                    />
                    <p className="text-muted-foreground text-xs">
                      Optional additional emails, comma or newline separated. The contact email above is treated as the main contact.
                    </p>
                  </div>
                )}
              </form.AppField>
            </>
          )}
        </>
      )
    }

    const getDescription = () => {
      switch (requestedBy) {
        case 'self':
          return 'The client always receives results. You can optionally add another recipient.'
        case 'employer':
          return 'Select an employer referral, or choose Other to submit a new inactive employer for review.'
        case 'court':
          return 'Select a court referral, or choose Other to submit a new inactive court for review.'
        default:
          return 'Please select who is requesting this screening first to see recipient options.'
      }
    }

    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Results Recipient</h2>
        </div>

        <div className="bg-chart-1/20 border-chart-1/40 mb-6 rounded-lg border p-4">
          <p className="text-chart-1 text-sm">{getDescription()}</p>
        </div>

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
